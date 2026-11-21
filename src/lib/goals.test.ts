import { describe, expect, it } from 'vitest';
import {
  addEvent,
  addGoal,
  addStep,
  addTask,
  deleteGoal,
  emptyState,
  eventsForDay,
  forwardTask,
  goalProgress,
  moveStep,
  scheduleStep,
  taskForStep,
  tasksForDay,
  updateTask,
} from './model';

const D1 = '2026-11-21';
const D2 = '2026-11-22';

function setup() {
  let s = emptyState();
  s = addGoal(s, { title: 'Launch EveryPlace site', tag: 'E', targetDate: '2026-12-31' });
  const goal = s.goals[0];
  s = addStep(s, goal.id, 'Write home page copy');
  s = addStep(s, goal.id, 'Pick hosting');
  return { s, goalId: goal.id };
}

describe('goals', () => {
  it('adds steps in order and reorders them', () => {
    const setupResult = setup();
    const { goalId } = setupResult;
    let { s } = setupResult;
    expect(s.goals[0].steps.map((x) => x.title)).toEqual(['Write home page copy', 'Pick hosting']);
    s = moveStep(s, goalId, s.goals[0].steps[1].id, -1);
    expect(s.goals[0].steps.map((x) => x.title)).toEqual(['Pick hosting', 'Write home page copy']);
  });

  it('puts a step on a day with the goal tag and link', () => {
    const setupResult = setup();
    const { goalId } = setupResult;
    let { s } = setupResult;
    s = addTask(s, { title: 'Existing', date: D1, priority: 'A' });
    const step = s.goals[0].steps[0];
    s = scheduleStep(s, goalId, step.id, D1, 'A');
    const task = tasksForDay(s, D1).find((t) => t.stepId === step.id)!;
    expect(task.title).toBe('Write home page copy');
    expect(task.rank).toBe(2);
    expect(task.tag).toBe('E');
    expect(task.goalId).toBe(goalId);
    expect(taskForStep(s, step.id)?.id).toBe(task.id);
  });

  it('checks the step off when its task is completed, and back on when unchecked', () => {
    const setupResult = setup();
    const { goalId } = setupResult;
    let { s } = setupResult;
    const step = s.goals[0].steps[0];
    s = scheduleStep(s, goalId, step.id, D1, 'B');
    const task = taskForStep(s, step.id)!;
    s = updateTask(s, task.id, { status: 'done' });
    expect(s.goals[0].steps[0].done).toBe(true);
    expect(goalProgress(s.goals[0])).toEqual({ done: 1, total: 2 });
    s = updateTask(s, task.id, { status: 'open' });
    expect(s.goals[0].steps[0].done).toBe(false);
  });

  it('keeps the goal link when a task is forwarded', () => {
    const setupResult = setup();
    const { goalId } = setupResult;
    let { s } = setupResult;
    const step = s.goals[0].steps[1];
    s = scheduleStep(s, goalId, step.id, D1, 'A');
    s = forwardTask(s, taskForStep(s, step.id)!.id, D2);
    const latest = taskForStep(s, step.id)!;
    expect(latest.date).toBe(D2);
    expect(latest.goalId).toBe(goalId);
    s = updateTask(s, latest.id, { status: 'done' });
    expect(s.goals[0].steps[1].done).toBe(true);
  });

  it('unlinks tasks when a goal is deleted', () => {
    const setupResult = setup();
    const { goalId } = setupResult;
    let { s } = setupResult;
    s = scheduleStep(s, goalId, s.goals[0].steps[0].id, D1, 'A');
    s = deleteGoal(s, goalId);
    expect(s.goals).toHaveLength(0);
    expect(s.tasks[0].goalId).toBeUndefined();
    expect(s.tasks[0].title).toBe('Write home page copy');
  });
});

describe('events', () => {
  it('lists a day’s events with untimed ones first, then by time', () => {
    let s = emptyState();
    s = addEvent(s, { title: 'Staff meeting', date: D1, time: '14:00', tag: 'B' });
    s = addEvent(s, { title: 'Mom’s birthday', date: D1 });
    s = addEvent(s, { title: 'Dentist', date: D1, time: '09:30' });
    s = addEvent(s, { title: 'Other day', date: D2 });
    expect(eventsForDay(s, D1).map((e) => e.title)).toEqual(['Mom’s birthday', 'Dentist', 'Staff meeting']);
  });
});
