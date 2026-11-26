// Core planner data and the pure functions that change it.
// Every function takes a PlannerState and returns a new one, so the
// storage layer (local now, cloud sync later) can stay separate.

export type Priority = 'A' | 'B' | 'C';
export const PRIORITIES: Priority[] = ['A', 'B', 'C'];

/** open = no mark yet; inwork = dot; done = check; forwarded = right arrow; cancelled = X. */
export type Status = 'open' | 'inwork' | 'done' | 'forwarded' | 'cancelled';

export interface ForwardEntry {
  from: string; // day key
  to: string; // day key
  fromRank: string; // e.g. "B2"
  toRank: string; // e.g. "B1"
  at: string; // ISO timestamp of the move
}

export interface Task {
  id: string;
  /** Shared by every copy of a task as it is forwarded from day to day. */
  chainId: string;
  title: string;
  date: string; // day key this copy sits on
  priority: Priority;
  rank: number; // 1-based order within its priority letter on that day
  status: Status;
  /** Initials of the person the task is delegated to. */
  delegatee?: string;
  /** Margin tag letter, e.g. "B" for Boeing. */
  tag?: string;
  notes?: string;
  /** When the task was first written down. Kept through every forward. */
  createdAt: string;
  /** The day the task was first planned for. */
  originDate: string;
  /** True when this copy arrived on its day by being forwarded. */
  arrivedByForward: boolean;
  /** For a copy left behind with status "forwarded": where it went. */
  forwardedTo?: string;
  /** For a copy left behind with status "forwarded": it was in work (dot) when forwarded, so the arrow is drawn over the dot. */
  forwardedInWork?: boolean;
  /** Every forward of this task, oldest first. */
  history: ForwardEntry[];
  /** Goal this task works toward, if any. */
  goalId?: string;
  /** The goal step this task carries out, if any. */
  stepId?: string;
  /** Written in the paper planner on this day. */
  onPaper?: boolean;
  /** Ids of photos of handwritten notes (stored in IndexedDB). */
  photos?: string[];
}

export interface GoalStep {
  id: string;
  title: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  why?: string;
  /** Day key the goal should be reached by. */
  targetDate?: string;
  /** Margin tag letter, e.g. "B" for Boeing. */
  tag?: string;
  steps: GoalStep[];
  done: boolean;
  createdAt: string;
  /** Written in the paper planner. */
  onPaper?: boolean;
}

export interface PlannerEvent {
  id: string;
  title: string;
  date: string; // day key
  time?: string; // "HH:MM"
  notes?: string;
  tag?: string;
  /** Written in the paper planner (month tab or day page). */
  onPaper?: boolean;
}

export interface MarginTag {
  letter: string;
  label: string;
}

export interface Settings {
  dailyTasks: string[];
  tags: MarginTag[];
  /** What to show for each priority letter, e.g. a heart for A. */
  prioritySymbols: Record<Priority, string>;
}

export interface PlannerState {
  version: 1;
  tasks: Task[];
  /** Status of each fixed daily task, by day then task name. */
  daily: Record<string, Record<string, Status>>;
  goals: Goal[];
  events: PlannerEvent[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyTasks: ['Pray', 'Read', 'Plan', 'Record', 'Prepare', 'Relax'],
  tags: [
    { letter: 'B', label: 'Boeing' },
    { letter: 'E', label: 'EveryPlace, LLC' },
  ],
  prioritySymbols: { A: 'A', B: 'B', C: 'C' },
};

export function emptyState(): PlannerState {
  return { version: 1, tasks: [], daily: {}, goals: [], events: [], settings: structuredClone(DEFAULT_SETTINGS) };
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function rankLabel(t: Pick<Task, 'priority' | 'rank'>): string {
  return `${t.priority}${t.rank}`;
}

const PRIORITY_ORDER: Record<Priority, number> = { A: 0, B: 1, C: 2 };

/** Tasks on a day in list order: A1, A2, B1, B2, B3, C1. */
export function tasksForDay(state: PlannerState, date: string): Task[] {
  return state.tasks
    .filter((t) => t.date === date)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.rank - b.rank);
}

function lettersOn(tasks: Task[], date: string, priority: Priority): Task[] {
  return tasks
    .filter((t) => t.date === date && t.priority === priority)
    .sort((a, b) => a.rank - b.rank);
}

/** Renumber one letter on one day to 1..n, keeping the current order. */
function renumber(tasks: Task[], date: string, priority: Priority): Task[] {
  const ordered = lettersOn(tasks, date, priority);
  const newRank = new Map(ordered.map((t, i) => [t.id, i + 1]));
  return tasks.map((t) => (newRank.has(t.id) ? { ...t, rank: newRank.get(t.id)! } : t));
}

export interface NewTaskInput {
  title: string;
  date: string;
  priority: Priority;
  tag?: string;
  notes?: string;
  goalId?: string;
  stepId?: string;
}

/** Adds a task at the bottom of its letter. */
export function addTask(state: PlannerState, input: NewTaskInput, now = new Date()): PlannerState {
  const title = input.title.trim();
  if (!title) return state;
  const rank = lettersOn(state.tasks, input.date, input.priority).length + 1;
  const id = newId();
  const task: Task = {
    id,
    chainId: id,
    title,
    date: input.date,
    priority: input.priority,
    rank,
    status: 'open',
    tag: input.tag || undefined,
    notes: input.notes || undefined,
    createdAt: now.toISOString(),
    originDate: input.date,
    arrivedByForward: false,
    history: [],
    goalId: input.goalId || undefined,
    stepId: input.stepId || undefined,
  };
  return { ...state, tasks: [...state.tasks, task] };
}

export function updateTask(
  state: PlannerState,
  id: string,
  patch: Partial<Pick<Task, 'title' | 'tag' | 'notes' | 'delegatee' | 'status' | 'goalId' | 'stepId' | 'onPaper' | 'photos'>>,
): PlannerState {
  const before = state.tasks.find((t) => t.id === id);
  let next: PlannerState = { ...state, tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
  // Checking off a task that carries out a goal step also checks the step.
  const after = next.tasks.find((t) => t.id === id);
  if (before && after?.goalId && after.stepId && patch.status && patch.status !== before.status) {
    if (patch.status === 'done') next = setStepDone(next, after.goalId, after.stepId, true);
    else if (before.status === 'done') next = setStepDone(next, after.goalId, after.stepId, false);
  }
  return next;
}

/** Moves a task to another priority letter, at the bottom of that letter. */
export function changePriority(state: PlannerState, id: string, priority: Priority): PlannerState {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.priority === priority) return state;
  const rank = lettersOn(state.tasks, task.date, priority).length + 1;
  let tasks = state.tasks.map((t) => (t.id === id ? { ...t, priority, rank } : t));
  tasks = renumber(tasks, task.date, task.priority);
  return { ...state, tasks };
}

/** Moves a task up (-1) or down (+1) within its letter. */
export function moveTask(state: PlannerState, id: string, delta: -1 | 1): PlannerState {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  const ordered = lettersOn(state.tasks, task.date, task.priority);
  const i = ordered.findIndex((t) => t.id === id);
  const j = i + delta;
  if (j < 0 || j >= ordered.length) return state;
  const other = ordered[j];
  const tasks = state.tasks.map((t) => {
    if (t.id === task.id) return { ...t, rank: other.rank };
    if (t.id === other.id) return { ...t, rank: task.rank };
    return t;
  });
  return { ...state, tasks };
}

export function deleteTask(state: PlannerState, id: string): PlannerState {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  let tasks = state.tasks.filter((t) => t.id !== id);
  tasks = renumber(tasks, task.date, task.priority);
  return { ...state, tasks };
}

/** Next status when the status mark is tapped: blank, dot, check, blank. */
export function nextStatus(s: Status): Status {
  if (s === 'open') return 'inwork';
  if (s === 'inwork') return 'done';
  return 'open';
}

/** Next status for a task when its status box is tapped: blank, dot, check, X, blank. */
export function nextTaskStatus(s: Status): Status {
  if (s === 'open') return 'inwork';
  if (s === 'inwork') return 'done';
  if (s === 'done') return 'cancelled';
  return 'open';
}

export function isUnfinished(t: Task): boolean {
  return t.status === 'open' || t.status === 'inwork';
}

/**
 * Forwards one task to another day.
 *
 * The copy on the old day keeps its place and gets the forwarded arrow.
 * A new copy goes on the new day with the same priority letter, placed at
 * the top of that letter after any tasks already forwarded there, so the
 * first forwarded task becomes 1, the second becomes 2, and tasks planned
 * there earlier shift down. Creation date and forward history carry over.
 */
export function forwardTask(state: PlannerState, id: string, toDate: string, now = new Date()): PlannerState {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || !isUnfinished(task) || toDate === task.date) return state;

  const target = lettersOn(state.tasks, toDate, task.priority);
  const forwardedAhead = target.filter((t) => t.arrivedByForward).length;
  const newRank = forwardedAhead + 1;

  const entry: ForwardEntry = {
    from: task.date,
    to: toDate,
    fromRank: rankLabel(task),
    toRank: `${task.priority}${newRank}`,
    at: now.toISOString(),
  };

  const copy: Task = {
    ...task,
    id: newId(),
    date: toDate,
    rank: newRank,
    status: task.status === 'inwork' ? 'inwork' : 'open',
    arrivedByForward: true,
    forwardedTo: undefined,
    // The new day's paper page doesn't have it yet.
    onPaper: false,
    history: [...task.history, entry],
  };

  const tasks = state.tasks.map((t) => {
    if (t.id === task.id)
      return {
        ...t,
        status: 'forwarded' as Status,
        forwardedTo: toDate,
        forwardedInWork: task.status === 'inwork' || undefined,
        history: copy.history,
        // The arrow still has to be drawn through the status box on paper.
        onPaper: false,
      };
    if (t.date === toDate && t.priority === task.priority && t.rank >= newRank) return { ...t, rank: t.rank + 1 };
    return t;
  });
  return { ...state, tasks: [...tasks, copy] };
}

/** Forwards every unfinished task on a day, keeping their list order. */
export function forwardUnfinished(state: PlannerState, fromDate: string, toDate: string, now = new Date()): PlannerState {
  const ids = tasksForDay(state, fromDate)
    .filter(isUnfinished)
    .map((t) => t.id);
  return ids.reduce((s, id) => forwardTask(s, id, toDate, now), state);
}

/** All copies of a task across days, oldest first. */
export function chainOf(state: PlannerState, chainId: string): Task[] {
  return state.tasks.filter((t) => t.chainId === chainId).sort((a, b) => a.date.localeCompare(b.date));
}

export function dailyStatus(state: PlannerState, date: string, name: string): Status {
  return state.daily[date]?.[name] ?? 'open';
}

export function setDailyStatus(state: PlannerState, date: string, name: string, status: Status): PlannerState {
  return {
    ...state,
    daily: { ...state.daily, [date]: { ...state.daily[date], [name]: status } },
  };
}

export function updateSettings(state: PlannerState, settings: Settings): PlannerState {
  return { ...state, settings };
}

// ---------- Goals ----------

export interface NewGoalInput {
  title: string;
  why?: string;
  targetDate?: string;
  tag?: string;
}

export function addGoal(state: PlannerState, input: NewGoalInput, now = new Date()): PlannerState {
  const title = input.title.trim();
  if (!title) return state;
  const goal: Goal = {
    id: newId(),
    title,
    why: input.why?.trim() || undefined,
    targetDate: input.targetDate || undefined,
    tag: input.tag || undefined,
    steps: [],
    done: false,
    createdAt: now.toISOString(),
  };
  return { ...state, goals: [...state.goals, goal] };
}

export function updateGoal(
  state: PlannerState,
  id: string,
  patch: Partial<Pick<Goal, 'title' | 'why' | 'targetDate' | 'tag' | 'done' | 'onPaper'>>,
): PlannerState {
  return { ...state, goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) };
}

/** Deletes a goal. Tasks linked to it stay on their days without the link. */
export function deleteGoal(state: PlannerState, id: string): PlannerState {
  return {
    ...state,
    goals: state.goals.filter((g) => g.id !== id),
    tasks: state.tasks.map((t) => (t.goalId === id ? { ...t, goalId: undefined, stepId: undefined } : t)),
  };
}

export function addStep(state: PlannerState, goalId: string, title: string): PlannerState {
  const clean = title.trim();
  if (!clean) return state;
  return {
    ...state,
    goals: state.goals.map((g) =>
      g.id === goalId ? { ...g, steps: [...g.steps, { id: newId(), title: clean, done: false }] } : g,
    ),
  };
}

export function updateStep(state: PlannerState, goalId: string, stepId: string, title: string): PlannerState {
  const clean = title.trim();
  if (!clean) return state;
  return {
    ...state,
    goals: state.goals.map((g) =>
      g.id === goalId ? { ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, title: clean } : s)) } : g,
    ),
  };
}

export function setStepDone(state: PlannerState, goalId: string, stepId: string, done: boolean): PlannerState {
  return {
    ...state,
    goals: state.goals.map((g) =>
      g.id === goalId ? { ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, done } : s)) } : g,
    ),
  };
}

export function moveStep(state: PlannerState, goalId: string, stepId: string, delta: -1 | 1): PlannerState {
  return {
    ...state,
    goals: state.goals.map((g) => {
      if (g.id !== goalId) return g;
      const i = g.steps.findIndex((s) => s.id === stepId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= g.steps.length) return g;
      const steps = [...g.steps];
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...g, steps };
    }),
  };
}

export function deleteStep(state: PlannerState, goalId: string, stepId: string): PlannerState {
  return {
    ...state,
    goals: state.goals.map((g) => (g.id === goalId ? { ...g, steps: g.steps.filter((s) => s.id !== stepId) } : g)),
    tasks: state.tasks.map((t) => (t.stepId === stepId ? { ...t, stepId: undefined } : t)),
  };
}

/** Puts a goal step on a day's task list, carrying the goal's margin tag. */
export function scheduleStep(
  state: PlannerState,
  goalId: string,
  stepId: string,
  date: string,
  priority: Priority,
  now = new Date(),
): PlannerState {
  const goal = state.goals.find((g) => g.id === goalId);
  const step = goal?.steps.find((s) => s.id === stepId);
  if (!goal || !step) return state;
  return addTask(state, { title: step.title, date, priority, tag: goal.tag, goalId, stepId }, now);
}

/** The latest copy of the task carrying out a step, if it has been scheduled. */
export function taskForStep(state: PlannerState, stepId: string): Task | undefined {
  return state.tasks
    .filter((t) => t.stepId === stepId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function goalProgress(goal: Goal): { done: number; total: number } {
  return { done: goal.steps.filter((s) => s.done).length, total: goal.steps.length };
}

// ---------- Events (monthly calendar) ----------

export interface NewEventInput {
  title: string;
  date: string;
  time?: string;
  notes?: string;
  tag?: string;
}

export function addEvent(state: PlannerState, input: NewEventInput): PlannerState {
  const title = input.title.trim();
  if (!title || !input.date) return state;
  const ev: PlannerEvent = {
    id: newId(),
    title,
    date: input.date,
    time: input.time || undefined,
    notes: input.notes?.trim() || undefined,
    tag: input.tag || undefined,
  };
  return { ...state, events: [...state.events, ev] };
}

export function updateEvent(
  state: PlannerState,
  id: string,
  patch: Partial<Pick<PlannerEvent, 'title' | 'date' | 'time' | 'notes' | 'tag' | 'onPaper'>>,
): PlannerState {
  return {
    ...state,
    events: state.events.map((e) => {
      if (e.id !== id) return e;
      const next = { ...e, ...patch };
      // Moving an event to another day means the paper copy is out of date.
      if (patch.date && patch.date !== e.date && patch.onPaper === undefined) next.onPaper = false;
      return next;
    }),
  };
}

export function deleteEvent(state: PlannerState, id: string): PlannerState {
  return { ...state, events: state.events.filter((e) => e.id !== id) };
}

/** Events on a day, untimed first, then by time. */
export function eventsForDay(state: PlannerState, date: string): PlannerEvent[] {
  return state.events
    .filter((e) => e.date === date)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title));
}
