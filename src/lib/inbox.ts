// The task inbox: tasks sent in from other systems (a Claude project, another
// app's export, a pasted list) wait here without a priority. While planning
// you give each one a letter and it goes on the day like any other task,
// keeping where it came from.
//
// The intake format is deliberately loose so most exports work as they are:
// a JSON task, a list of them, { "tasks": [...] }, CSV with a header row, or
// plain text with one task per line. See docs/task-inbox.md.

import { addTask, newId, PRIORITIES, type InboxItem, type MarginTag, type PlannerState, type Priority, type TaskSource } from './model';

/** One task as another system sends it, before it is in the inbox. */
export interface IntakeTask {
  title: string;
  notes?: string;
  tag?: string;
  due?: string;
  priority?: Priority;
  source?: string;
  link?: string;
  /** The sender's own id for the task, so sending it twice adds it once. */
  id?: string;
}

const pick = (o: Record<string, unknown>, names: string[]): string | undefined => {
  for (const n of names) {
    const v = o[n];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return undefined;
};

/** "2026-12-03", "2026-12-03T17:00:00Z" or "12/3/2026" → "2026-12-03". */
export function toDayKey(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return undefined;
}

function toPriority(v: string | undefined): Priority | undefined {
  if (!v) return undefined;
  const c = v.trim().charAt(0).toUpperCase();
  if ((PRIORITIES as string[]).includes(c)) return c as Priority;
  const w = v.trim().toLowerCase();
  if (w === 'high' || w === 'must' || w === 'urgent') return 'A';
  if (w === 'medium' || w === 'normal' || w === 'should') return 'B';
  if (w === 'low' || w === 'want') return 'C';
  return undefined;
}

/** Reads one task object, accepting the field names common exports use. */
export function readTask(o: unknown): IntakeTask | null {
  if (typeof o === 'string') return o.trim() ? { title: o.trim().slice(0, 300) } : null;
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const title = pick(r, ['title', 'task', 'name', 'summary', 'content', 'text', 'subject']);
  if (!title) return null;
  const tag = pick(r, ['tag', 'margin', 'category'])?.toUpperCase().slice(0, 2);
  return {
    title: title.slice(0, 300),
    notes: pick(r, ['notes', 'note', 'description', 'details', 'body'])?.slice(0, 5000),
    tag: tag || undefined,
    due: toDayKey(pick(r, ['due', 'dueDate', 'due_date', 'deadline', 'date'])),
    priority: toPriority(pick(r, ['priority', 'abc'])),
    source: pick(r, ['source', 'from', 'project'])?.slice(0, 100),
    link: pick(r, ['link', 'url', 'href'])?.slice(0, 1000),
    id: pick(r, ['id', 'externalId', 'uid', 'key'])?.slice(0, 200),
  };
}

/** Reads a JSON value: one task, a list of tasks, or { tasks: [...] }. */
export function readTasks(data: unknown): IntakeTask[] {
  if (Array.isArray(data)) return data.map(readTask).filter((t): t is IntakeTask => !!t);
  if (data && typeof data === 'object') {
    const r = data as Record<string, unknown>;
    for (const k of ['tasks', 'items', 'todos']) if (Array.isArray(r[k])) return readTasks(r[k]);
  }
  const one = readTask(data);
  return one ? [one] : [];
}

/** Splits one CSV line, honoring "quoted, values" and "" escapes. */
function csvCells(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const TITLE_HEADERS = ['title', 'task', 'name', 'summary', 'content', 'subject'];

/**
 * Reads pasted text or a file's contents. JSON and CSV (with a header row
 * naming a title column) are read field by field; anything else is one task
 * per line, with list bullets and checkboxes stripped. A line may start with
 * one of your margin letters, like "[B] Send slides" or "B: Send slides".
 */
export function parseTaskText(text: string, tags: MarginTag[] = []): IntakeTask[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/^[[{]/.test(trimmed)) {
    try {
      return readTasks(JSON.parse(trimmed));
    } catch {
      // Not JSON after all; read it as lines.
    }
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  const header = csvCells(lines[0]).map((h) => h.toLowerCase());
  if (lines.length > 1 && lines[0].includes(',') && header.some((h) => TITLE_HEADERS.includes(h))) {
    return lines
      .slice(1)
      .map((l) => {
        const cells = csvCells(l);
        return readTask(Object.fromEntries(header.map((h, i) => [h.replace(/\s+/g, '_'), cells[i] ?? ''])));
      })
      .filter((t): t is IntakeTask => !!t);
  }
  const letters = new Set(tags.map((t) => t.letter.toUpperCase()));
  return lines
    .map((raw) => {
      let line = raw.trim().replace(/^([-*•]|\d+[.)])\s+/, '').replace(/^\[[ xX]?\]\s+/, '');
      let tag: string | undefined;
      const m = /^\[(\w{1,2})\]\s+(.+)$/.exec(line) ?? /^(\w{1,2}):\s+(.+)$/.exec(line);
      if (m && letters.has(m[1].toUpperCase())) {
        tag = m[1].toUpperCase();
        line = m[2];
      }
      return line ? ({ title: line.slice(0, 300), tag } as IntakeTask) : null;
    })
    .filter((t): t is IntakeTask => !!t);
}

/** True when this task is already in the inbox or on a day. */
function alreadyHave(state: PlannerState, intakeId: string | undefined, externalId: string | undefined): boolean {
  const seen = (src?: TaskSource) =>
    !!src && ((!!intakeId && src.intakeId === intakeId) || (!!externalId && src.externalId === externalId));
  return state.inbox.some((i) => i.id === intakeId || seen(i.source)) || state.tasks.some((t) => seen(t.source));
}

/**
 * Adds tasks to the inbox. `intakeId` is the id the task had in the cloud
 * drop box, when it came from there. Repeats (same intake id, or same id
 * from the sender) are skipped, so sending a task twice adds it once.
 */
export function addToInbox(
  state: PlannerState,
  incoming: (IntakeTask & { intakeId?: string })[],
  defaultSource: string,
  now = new Date(),
): { state: PlannerState; added: number } {
  let s = state;
  let added = 0;
  for (const t of incoming) {
    const title = t.title?.trim();
    if (!title) continue;
    if (alreadyHave(s, t.intakeId, t.id)) continue;
    const id = t.intakeId ?? newId();
    const item: InboxItem = {
      id,
      title,
      notes: t.notes || undefined,
      tag: t.tag || undefined,
      due: toDayKey(t.due),
      suggested: t.priority,
      source: {
        name: t.source || defaultSource,
        link: t.link || undefined,
        externalId: t.id || undefined,
        intakeId: id,
        receivedAt: now.toISOString(),
      },
    };
    s = { ...s, inbox: [...s.inbox, JSON.parse(JSON.stringify(item))] };
    added++;
  }
  return { state: s, added };
}

/**
 * Gives an inbox task a letter and puts it at the bottom of that letter on a
 * day. Its creation date is when it reached the inbox.
 */
export function planInboxItem(state: PlannerState, id: string, date: string, priority: Priority, now = new Date()): PlannerState {
  const item = state.inbox.find((i) => i.id === id);
  if (!item) return state;
  const next = addTask(state, { title: item.title, date, priority, tag: item.tag, notes: item.notes }, now);
  const task = next.tasks[next.tasks.length - 1];
  return {
    ...next,
    tasks: next.tasks.map((t) => (t.id === task.id ? { ...t, createdAt: item.source.receivedAt, source: item.source, due: item.due } : t)),
    inbox: next.inbox.filter((i) => i.id !== id),
  };
}

export function dismissInboxItem(state: PlannerState, id: string): PlannerState {
  return { ...state, inbox: state.inbox.filter((i) => i.id !== id) };
}

/** Inbox in the order to plan it: due soonest first, then oldest first. */
export function inboxOrder(state: PlannerState): InboxItem[] {
  return [...state.inbox].sort(
    (a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.source.receivedAt.localeCompare(b.source.receivedAt),
  );
}
