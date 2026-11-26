import { describe, expect, it } from 'vitest';
import { addTask, DEFAULT_SETTINGS, emptyState, tasksForDay } from './model';
import { addToInbox, dismissInboxItem, inboxOrder, parseTaskText, planInboxItem, readTask } from './inbox';
import { applyDoc, diffState } from './syncModel';
import { normalize } from './store';

const D1 = '2026-11-25';

describe('task inbox', () => {
  it('reads the documented fields and common aliases', () => {
    expect(readTask({ title: 'Send slides', tag: 'b', due: '2026-12-03T17:00:00Z', priority: 'high', source: 'Claude: Spec', id: 'x1' })).toEqual({
      title: 'Send slides',
      notes: undefined,
      tag: 'B',
      due: '2026-12-03',
      priority: 'A',
      source: 'Claude: Spec',
      link: undefined,
      id: 'x1',
    });
    expect(readTask({ content: 'Call Pat', description: 'About the lease', dueDate: '12/4/2026', url: 'https://x.test/1' })).toMatchObject({
      title: 'Call Pat',
      notes: 'About the lease',
      due: '2026-12-04',
      link: 'https://x.test/1',
    });
    expect(readTask({ notes: 'no title' })).toBeNull();
  });

  it('parses JSON, CSV and plain lines', () => {
    expect(parseTaskText('{"tasks":[{"title":"A"},{"name":"B"}]}').map((t) => t.title)).toEqual(['A', 'B']);
    expect(parseTaskText('[{"title":"One"}]').map((t) => t.title)).toEqual(['One']);
    const csv = 'Title,Notes,Due Date\n"Fix bug, urgent","Repro ""steps""",2026-12-01\nWrite docs,,';
    expect(parseTaskText(csv)).toEqual([
      expect.objectContaining({ title: 'Fix bug, urgent', notes: 'Repro "steps"', due: '2026-12-01' }),
      expect.objectContaining({ title: 'Write docs' }),
    ]);
    const lines = parseTaskText('- [ ] Send slides\n* [B] Book travel\n2. E: Renew license\nX: not a tag\n\n', DEFAULT_SETTINGS.tags);
    expect(lines).toEqual([
      { title: 'Send slides', tag: undefined },
      { title: 'Book travel', tag: 'B' },
      { title: 'Renew license', tag: 'E' },
      { title: 'X: not a tag', tag: undefined },
    ]);
  });

  it('skips repeats by sender id and drop-box id, even after planning', () => {
    const first = addToInbox(emptyState(), [{ title: 'Review PR', id: 'pr-9' }, { title: 'Dropped', intakeId: 'd1' }], 'Test');
    expect(first.added).toBe(2);
    const state = planInboxItem(first.state, first.state.inbox[0].id, D1, 'A');
    const again = addToInbox(state, [{ title: 'Review PR', id: 'pr-9' }, { title: 'Dropped', intakeId: 'd1' }, { title: 'New' }], 'Test');
    expect(again.added).toBe(1);
    expect(again.state.inbox.map((i) => i.title)).toEqual(['Dropped', 'New']);
  });

  it('planning puts it at the bottom of the letter, keeping source, tag, notes and arrival date', () => {
    let s = addTask(emptyState(), { title: 'Existing', date: D1, priority: 'B' });
    const now = new Date('2026-11-20T10:00:00Z');
    s = addToInbox(s, [{ title: 'From Claude', tag: 'E', notes: 'ctx', due: '2026-11-30', source: 'Claude: X', link: 'https://x.test' }], 'Sent in', now).state;
    s = planInboxItem(s, s.inbox[0].id, D1, 'B', new Date('2026-11-25T08:00:00Z'));
    expect(s.inbox).toEqual([]);
    const [first, second] = tasksForDay(s, D1);
    expect(first.title).toBe('Existing');
    expect(second).toMatchObject({
      title: 'From Claude',
      priority: 'B',
      rank: 2,
      tag: 'E',
      notes: 'ctx',
      due: '2026-11-30',
      createdAt: now.toISOString(),
      source: { name: 'Claude: X', link: 'https://x.test' },
    });
  });

  it('orders by due date, then arrival; dismiss removes', () => {
    let s = addToInbox(emptyState(), [{ title: 'Later' }], 'T', new Date('2026-11-01')).state;
    s = addToInbox(s, [{ title: 'Due soon', due: '2026-11-26' }], 'T', new Date('2026-11-02')).state;
    expect(inboxOrder(s).map((i) => i.title)).toEqual(['Due soon', 'Later']);
    expect(dismissInboxItem(s, s.inbox[0].id).inbox.map((i) => i.title)).toEqual(['Due soon']);
  });

  it('syncs to other devices and survives old backups without an inbox', () => {
    const a = addToInbox(emptyState(), [{ title: 'Sync me' }], 'T').state;
    const ops = diffState(emptyState(), a);
    expect(ops).toEqual([expect.objectContaining({ coll: 'inbox' })]);
    expect(ops.reduce(applyDoc, emptyState()).inbox.map((i) => i.title)).toEqual(['Sync me']);
    expect(normalize({ tasks: [] }).inbox).toEqual([]);
  });
});
