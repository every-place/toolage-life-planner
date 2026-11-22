import { describe, expect, it } from 'vitest';
import {
  addTask,
  changePriority,
  chainOf,
  deleteTask,
  emptyState,
  forwardTask,
  forwardUnfinished,
  moveTask,
  nextTaskStatus,
  rankLabel,
  tasksForDay,
  updateTask,
  type PlannerState,
} from './model';

const D1 = '2026-11-21';
const D2 = '2026-11-22';
const D3 = '2026-11-23';

function labels(s: PlannerState, date: string) {
  return tasksForDay(s, date).map((t) => `${rankLabel(t)} ${t.title}`);
}

function byTitle(s: PlannerState, date: string, title: string) {
  return tasksForDay(s, date).find((t) => t.title === title)!;
}

describe('ranking', () => {
  it('numbers tasks within each letter and sorts A before B before C', () => {
    let s = emptyState();
    s = addTask(s, { title: 'Want', date: D1, priority: 'C' });
    s = addTask(s, { title: 'Must 1', date: D1, priority: 'A' });
    s = addTask(s, { title: 'Should', date: D1, priority: 'B' });
    s = addTask(s, { title: 'Must 2', date: D1, priority: 'A' });
    expect(labels(s, D1)).toEqual(['A1 Must 1', 'A2 Must 2', 'B1 Should', 'C1 Want']);
  });

  it('moves a task within its letter and renumbers after delete or priority change', () => {
    let s = emptyState();
    for (const t of ['one', 'two', 'three']) s = addTask(s, { title: t, date: D1, priority: 'B' });
    s = moveTask(s, byTitle(s, D1, 'three').id, -1);
    expect(labels(s, D1)).toEqual(['B1 one', 'B2 three', 'B3 two']);
    s = deleteTask(s, byTitle(s, D1, 'one').id);
    expect(labels(s, D1)).toEqual(['B1 three', 'B2 two']);
    s = changePriority(s, byTitle(s, D1, 'three').id, 'A');
    expect(labels(s, D1)).toEqual(['A1 three', 'B1 two']);
  });

  it('ignores blank titles', () => {
    const s = addTask(emptyState(), { title: '   ', date: D1, priority: 'A' });
    expect(s.tasks).toHaveLength(0);
  });
});

describe('forwarding', () => {
  it('keeps the letter and puts forwarded tasks at the top of it, in order', () => {
    let s = emptyState();
    s = addTask(s, { title: 'Dentist', date: D2, priority: 'A' });
    s = addTask(s, { title: 'Call bank', date: D1, priority: 'A' });
    s = addTask(s, { title: 'Email Joe', date: D1, priority: 'A' });
    s = addTask(s, { title: 'File taxes', date: D1, priority: 'B' });

    s = forwardTask(s, byTitle(s, D1, 'Call bank').id, D2);
    s = forwardTask(s, byTitle(s, D1, 'Email Joe').id, D2);
    s = forwardTask(s, byTitle(s, D1, 'File taxes').id, D2);

    expect(labels(s, D2)).toEqual(['A1 Call bank', 'A2 Email Joe', 'A3 Dentist', 'B1 File taxes']);
  });

  it('leaves the old copy in place with the forwarded mark', () => {
    let s = emptyState();
    s = addTask(s, { title: 'Call bank', date: D1, priority: 'A' });
    s = forwardTask(s, byTitle(s, D1, 'Call bank').id, D2);
    const old = byTitle(s, D1, 'Call bank');
    expect(old.status).toBe('forwarded');
    expect(old.forwardedTo).toBe(D2);
    expect(rankLabel(old)).toBe('A1');
  });

  it('keeps the creation date and records every forward', () => {
    let s = emptyState();
    s = addTask(s, { title: 'Call bank', date: D1, priority: 'B' }, new Date('2026-11-21T08:00:00Z'));
    s = addTask(s, { title: 'Other', date: D1, priority: 'B' });
    s = moveTask(s, byTitle(s, D1, 'Call bank').id, 1); // now B2
    s = forwardTask(s, byTitle(s, D1, 'Call bank').id, D2, new Date('2026-11-21T20:00:00Z'));
    s = forwardTask(s, byTitle(s, D2, 'Call bank').id, D3, new Date('2026-11-22T20:00:00Z'));

    const latest = byTitle(s, D3, 'Call bank');
    expect(latest.createdAt).toBe('2026-11-21T08:00:00.000Z');
    expect(latest.originDate).toBe(D1);
    expect(latest.history).toEqual([
      { from: D1, to: D2, fromRank: 'B2', toRank: 'B1', at: '2026-11-21T20:00:00.000Z' },
      { from: D2, to: D3, fromRank: 'B1', toRank: 'B1', at: '2026-11-22T20:00:00.000Z' },
    ]);
    expect(chainOf(s, latest.chainId).map((t) => t.date)).toEqual([D1, D2, D3]);
  });

  it('does not forward finished tasks', () => {
    let s = emptyState();
    s = addTask(s, { title: 'Done', date: D1, priority: 'A' });
    s = updateTask(s, byTitle(s, D1, 'Done').id, { status: 'done' });
    const after = forwardTask(s, byTitle(s, D1, 'Done').id, D2);
    expect(after).toBe(s);
  });

  it('forwards all unfinished tasks in list order and skips finished ones', () => {
    let s = emptyState();
    s = addTask(s, { title: 'Planned', date: D2, priority: 'B' });
    s = addTask(s, { title: 'B one', date: D1, priority: 'B' });
    s = addTask(s, { title: 'A done', date: D1, priority: 'A' });
    s = addTask(s, { title: 'B two', date: D1, priority: 'B' });
    s = addTask(s, { title: 'A open', date: D1, priority: 'A' });
    s = updateTask(s, byTitle(s, D1, 'A done').id, { status: 'done' });
    s = updateTask(s, byTitle(s, D1, 'B two').id, { status: 'inwork', delegatee: 'JS', tag: 'E' });

    s = forwardUnfinished(s, D1, D2);

    expect(labels(s, D2)).toEqual(['A1 A open', 'B1 B one', 'B2 B two', 'B3 Planned']);
    const moved = byTitle(s, D2, 'B two');
    expect(moved.status).toBe('inwork');
    expect(moved.delegatee).toBe('JS');
    expect(moved.tag).toBe('E');
    expect(tasksForDay(s, D1).map((t) => t.status)).toEqual(['done', 'forwarded', 'forwarded', 'forwarded']);
  });
});

describe('status cycle', () => {
  it('taps through blank, dot, check, X and back to blank', () => {
    const seen = ['open' as const];
    let st: ReturnType<typeof nextTaskStatus> = 'open';
    for (let i = 0; i < 4; i++) {
      st = nextTaskStatus(st);
      seen.push(st as never);
    }
    expect(seen).toEqual(['open', 'inwork', 'done', 'cancelled', 'open']);
  });
});
