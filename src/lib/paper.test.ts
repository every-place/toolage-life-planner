import { describe, expect, it } from 'vitest';
import { addEvent, addTask, emptyState, forwardTask, tasksForDay, updateEvent, updateTask } from './model';

const D1 = '2026-11-21';
const D2 = '2026-11-22';

describe('on paper', () => {
  it('a forwarded task needs writing on the new day’s page', () => {
    let s = addTask(emptyState(), { title: 'Call bank', date: D1, priority: 'A' });
    s = updateTask(s, s.tasks[0].id, { onPaper: true });
    s = forwardTask(s, s.tasks[0].id, D2);
    expect(tasksForDay(s, D1)[0].onPaper).toBe(true);
    expect(tasksForDay(s, D2)[0].onPaper).toBe(false);
  });

  it('moving an event to another day clears its paper mark; other edits keep it', () => {
    let s = addEvent(emptyState(), { title: 'Dentist', date: D1 });
    const id = s.events[0].id;
    s = updateEvent(s, id, { onPaper: true });
    s = updateEvent(s, id, { title: 'Dentist, Dr. Lee' });
    expect(s.events[0].onPaper).toBe(true);
    s = updateEvent(s, id, { date: D2 });
    expect(s.events[0].onPaper).toBe(false);
  });

  it('forwarded copies keep the note photos', () => {
    let s = addTask(emptyState(), { title: 'Meeting notes', date: D1, priority: 'B' });
    s = updateTask(s, s.tasks[0].id, { photos: ['ph-1', 'ph-2'] });
    s = forwardTask(s, s.tasks[0].id, D2);
    expect(tasksForDay(s, D2)[0].photos).toEqual(['ph-1', 'ph-2']);
  });
});
