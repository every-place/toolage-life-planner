import { describe, expect, it } from 'vitest';
import { addEvent, addTask, emptyState, forwardTask, forwardUnfinished, tasksForDay, updateEvent, updateTask } from './model';

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

  it('cancelled tasks stay on their day and are not forwarded', () => {
    let s = addTask(emptyState(), { title: 'Lunch with Joe', date: D1, priority: 'B' });
    s = addTask(s, { title: 'Call bank', date: D1, priority: 'A' });
    s = updateTask(s, tasksForDay(s, D1)[1].id, { status: 'cancelled' });
    s = forwardUnfinished(s, D1, D2);
    expect(tasksForDay(s, D1).map((t) => t.status)).toEqual(['forwarded', 'cancelled']);
    expect(tasksForDay(s, D2).map((t) => t.title)).toEqual(['Call bank']);
  });
});
