import { describe, expect, it } from 'vitest';
import { addEvent, addTask, emptyState, forwardTask, setDailyStatus, tasksForDay, updateSettings, updateTask } from './model';
import { applyDoc, diffState, mergeFirst, type DocOp } from './syncModel';

const D1 = '2026-11-21';
const D2 = '2026-11-22';

/** Plays document writes onto another device's state, as the cloud would. */
const play = (s: ReturnType<typeof emptyState>, ops: DocOp[]) => ops.reduce(applyDoc, s);

describe('cloud sync', () => {
  it('writes only what changed', () => {
    const a = addTask(emptyState(), { title: 'Call bank', date: D1, priority: 'A' });
    const b = updateTask(a, a.tasks[0].id, { status: 'done' });
    const ops = diffState(a, b);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ coll: 'tasks', id: a.tasks[0].id });
    expect(diffState(b, b)).toEqual([]);
  });

  it('a forward, a daily mark, an event and settings reach the other device', () => {
    let pc = addTask(emptyState(), { title: 'Draft report', date: D1, priority: 'A' });
    let phone = play(emptyState(), diffState(emptyState(), pc));
    const before = pc;
    pc = forwardTask(pc, pc.tasks[0].id, D2);
    pc = setDailyStatus(pc, D1, 'Pray', 'done');
    pc = addEvent(pc, { title: 'Dentist', date: D2, time: '09:30' });
    pc = updateSettings(pc, { ...pc.settings, prioritySymbols: { A: '♥', B: 'B', C: 'C' } });
    phone = play(phone, diffState(before, pc));
    expect(tasksForDay(phone, D2).map((t) => t.title)).toEqual(['Draft report']);
    expect(tasksForDay(phone, D1)[0].status).toBe('forwarded');
    expect(phone.daily[D1].Pray).toBe('done');
    expect(phone.events[0].title).toBe('Dentist');
    expect(phone.settings.prioritySymbols.A).toBe('♥');
  });

  it('deleting on one device deletes on the other', () => {
    const a = addTask(addTask(emptyState(), { title: 'One', date: D1, priority: 'A' }), { title: 'Two', date: D1, priority: 'B' });
    const b = { ...a, tasks: a.tasks.slice(1) };
    const ops = diffState(a, b);
    expect(ops).toEqual([{ coll: 'tasks', id: a.tasks[0].id, data: null }]);
    expect(play(a, ops).tasks.map((t) => t.title)).toEqual(['Two']);
  });

  it('never sends undefined values (the cloud rejects them)', () => {
    const a = addTask(emptyState(), { title: 'X', date: D1, priority: 'A' });
    const ops = diffState(emptyState(), a);
    expect(JSON.stringify(ops)).toBe(JSON.stringify(JSON.parse(JSON.stringify(ops))));
    expect(Object.values(ops[0].data!).includes(undefined)).toBe(false);
  });

  it('first sign-in keeps what only this device has and takes the cloud copy of the rest', () => {
    const shared = addTask(emptyState(), { title: 'Shared', date: D1, priority: 'A' });
    const cloudOps = diffState(emptyState(), updateTask(shared, shared.tasks[0].id, { status: 'done' }));
    const local = addTask(shared, { title: 'Only on phone', date: D1, priority: 'B' });
    const merged = mergeFirst(local, cloudOps);
    expect(merged.tasks.map((t) => [t.title, t.status])).toEqual([
      ['Shared', 'done'],
      ['Only on phone', 'open'],
    ]);
    // Only the phone-only task needs uploading.
    const up = diffState(mergeFirst(emptyState(), cloudOps), merged);
    expect(up.map((o) => o.coll)).toEqual(['tasks']);
  });

  it('applying the same change twice changes nothing', () => {
    const a = addTask(emptyState(), { title: 'X', date: D1, priority: 'A' });
    const ops = diffState(emptyState(), a);
    const once = play(a, ops);
    expect(play(once, ops)).toBe(once);
  });
});
