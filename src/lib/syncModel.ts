// Pure helpers for cloud sync. The planner is stored in Firestore as one
// document per task, goal, event and day of daily-task marks, plus one for
// settings, all under users/{uid}. These functions turn local state changes
// into document writes and apply document changes back onto local state.

import { DEFAULT_SETTINGS, type Goal, type PlannerEvent, type PlannerState, type Settings, type Status, type Task } from './model';

export type Coll = 'tasks' | 'goals' | 'events' | 'days' | 'meta';
export const COLLECTIONS: Coll[] = ['tasks', 'goals', 'events', 'days', 'meta'];
export const SETTINGS_ID = 'settings';

/** One document write: data, or null to delete it. */
export interface DocOp {
  coll: Coll;
  id: string;
  data: Record<string, unknown> | null;
}

/** Firestore rejects undefined values, so drop them. */
export function clean<T>(v: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(v));
}

function diffList<T extends { id: string }>(coll: Coll, a: T[], b: T[], ops: DocOp[]) {
  if (a === b) return;
  const before = new Map(a.map((x) => [x.id, x]));
  for (const x of b) {
    const old = before.get(x.id);
    before.delete(x.id);
    if (old === x) continue;
    if (old && JSON.stringify(old) === JSON.stringify(x)) continue;
    ops.push({ coll, id: x.id, data: clean(x) });
  }
  for (const id of before.keys()) ops.push({ coll, id, data: null });
}

/** The document writes that turn state `a` into state `b`. */
export function diffState(a: PlannerState, b: PlannerState): DocOp[] {
  const ops: DocOp[] = [];
  diffList('tasks', a.tasks, b.tasks, ops);
  diffList('goals', a.goals, b.goals, ops);
  diffList('events', a.events, b.events, ops);
  if (a.daily !== b.daily) {
    const days = new Set([...Object.keys(a.daily), ...Object.keys(b.daily)]);
    for (const d of days) {
      const x = a.daily[d];
      const y = b.daily[d];
      if (x === y || JSON.stringify(x) === JSON.stringify(y)) continue;
      ops.push({ coll: 'days', id: d, data: y ? clean(y) : null });
    }
  }
  if (a.settings !== b.settings && JSON.stringify(a.settings) !== JSON.stringify(b.settings)) {
    ops.push({ coll: 'meta', id: SETTINGS_ID, data: clean(b.settings) });
  }
  return ops;
}

function upsert<T extends { id: string }>(list: T[], id: string, data: Record<string, unknown> | null): T[] {
  const i = list.findIndex((x) => x.id === id);
  if (data === null) return i < 0 ? list : list.filter((x) => x.id !== id);
  const item = { ...data, id } as unknown as T;
  if (i < 0) return [...list, item];
  if (JSON.stringify(list[i]) === JSON.stringify(item)) return list;
  const next = list.slice();
  next[i] = item;
  return next;
}

/** Applies one document change from the cloud to local state. */
export function applyDoc(s: PlannerState, op: DocOp): PlannerState {
  switch (op.coll) {
    case 'tasks': {
      const tasks = upsert<Task>(s.tasks, op.id, op.data);
      return tasks === s.tasks ? s : { ...s, tasks };
    }
    case 'goals': {
      const goals = upsert<Goal>(s.goals, op.id, op.data);
      return goals === s.goals ? s : { ...s, goals };
    }
    case 'events': {
      const events = upsert<PlannerEvent>(s.events, op.id, op.data);
      return events === s.events ? s : { ...s, events };
    }
    case 'days': {
      if (op.data === null) {
        if (!(op.id in s.daily)) return s;
        const daily = { ...s.daily };
        delete daily[op.id];
        return { ...s, daily };
      }
      if (JSON.stringify(s.daily[op.id]) === JSON.stringify(op.data)) return s;
      return { ...s, daily: { ...s.daily, [op.id]: op.data as Record<string, Status> } };
    }
    case 'meta': {
      if (op.id !== SETTINGS_ID || op.data === null) return s;
      const settings = { ...DEFAULT_SETTINGS, ...(op.data as Partial<Settings>) };
      return JSON.stringify(settings) === JSON.stringify(s.settings) ? s : { ...s, settings };
    }
  }
}

/**
 * First sign-in on a device: everything already in the cloud plus anything
 * only this device has. Where both have the same item, the cloud copy wins.
 * Settings come from the cloud when it has them.
 */
export function mergeFirst(local: PlannerState, remote: DocOp[]): PlannerState {
  let s = local;
  for (const op of remote) s = applyDoc(s, op);
  return s;
}
