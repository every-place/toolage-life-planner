import { TagSelect } from './TagSelect';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, dayOfYear, daysLeftInYear, formatLong, formatTime, today } from '../lib/dates';
import {
  PRIORITIES,
  addTask,
  dailyStatus,
  eventsForDay,
  forwardUnfinished,
  isUnfinished,
  nextStatus,
  nextTaskStatus,
  setDailyStatus,
  tasksForDay,
  updateEvent,
  updateTask,
  type PlannerEvent,
  type PlannerState,
  type Priority,
  type Task,
} from '../lib/model';
import { StatusMark, statusLabel } from './StatusMark';
import { TaskDetail } from './TaskDetail';
import { EventDialog } from './EventDialog';
import { PaperToggle } from './PaperToggle';
import { RowThumb } from './RowThumb';

interface Props {
  state: PlannerState;
  apply: (fn: (s: PlannerState) => PlannerState) => void;
  date: string;
  setDate: (d: string) => void;
  onOpenGoal: (goalId: string) => void;
}

export function DayPage({ state, apply, date, setDate, onOpenGoal }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [eventEdit, setEventEdit] = useState<PlannerEvent | 'new' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('A');
  const [newTag, setNewTag] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [forwardTo, setForwardTo] = useState(addDays(date, 1));
  const [toast, setToast] = useState<{ text: string; date: string } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const { settings } = state;

  useEffect(() => setForwardTo(addDays(date, 1)), [date]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const tasks = useMemo(() => tasksForDay(state, date), [state, date]);
  const events = useMemo(() => eventsForDay(state, date), [state, date]);
  const unfinished = tasks.filter(isUnfinished);
  const notOnPaper = tasks.filter((t) => t.status !== 'forwarded' && !t.onPaper).length + events.filter((e) => !e.onPaper).length;
  const openTask = openId ? state.tasks.find((t) => t.id === openId) : undefined;
  const isToday = date === today();
  const activeGoals = state.goals.filter((g) => !g.done);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const goal = state.goals.find((g) => g.id === newGoal);
    apply((s) =>
      addTask(s, { title: newTitle, date, priority: newPriority, tag: newTag || goal?.tag, goalId: newGoal || undefined }),
    );
    setNewTitle('');
    setNewGoal('');
    titleRef.current?.focus();
  };

  const cycle = (t: Task) => {
    if (t.status === 'forwarded') {
      setOpenId(t.id);
      return;
    }
    apply((s) => updateTask(s, t.id, { status: nextTaskStatus(t.status) }));
  };

  const forwardAll = () => {
    const n = unfinished.length;
    const to = forwardTo;
    apply((s) => forwardUnfinished(s, date, to));
    setToast({ text: `Forwarded ${n} ${n === 1 ? 'task' : 'tasks'} to ${formatLong(to)}.`, date: to });
  };

  const tagLabel = (letter?: string) => settings.tags.find((t) => t.letter === letter)?.label ?? '';
  const goalTitle = (id?: string) => state.goals.find((g) => g.id === id)?.title;

  return (
    <>
      <nav className="daynav" aria-label="Choose day">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <div className="daytitle">
          <h1>{formatLong(date)}</h1>
          <p className="muted small">
            Day {dayOfYear(date)} · {daysLeftInYear(date)} left
            {!isToday && (
              <>
                {' · '}
                <button className="link" onClick={() => setDate(today())}>
                  Back to today
                </button>
              </>
            )}
          </p>
        </div>
        <input
          id="day-picker"
          className="daypicker"
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="Go to date"
        />
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          ›
        </button>
      </nav>

      {settings.dailyTasks.length > 0 && (
        <section className="daily" aria-label="Daily tasks">
          {settings.dailyTasks.map((name) => {
            const st = dailyStatus(state, date, name);
            return (
              <button
                key={name}
                className={`chip chip-${st}`}
                onClick={() => apply((s) => setDailyStatus(s, date, name, nextStatus(st)))}
                aria-label={`${name}: ${statusLabel(st)}`}
              >
                <StatusMark status={st} />
                {name}
              </button>
            );
          })}
        </section>
      )}

      <section className="events card" aria-label="Appointments and events">
        <div className="list-head">
          <h2>Appointments</h2>
          <button className="link small" onClick={() => setEventEdit('new')}>
            + Add
          </button>
        </div>
        {events.length === 0 ? (
          <p className="muted small events-empty">Nothing scheduled. Events you add on the Month page show up here on their day.</p>
        ) : (
          <ul className="event-list">
            {events.map((ev) => (
              <li key={ev.id} className="event-row">
                <button className="event-btn" onClick={() => setEventEdit(ev)}>
                  <span className="event-time">{ev.time ? formatTime(ev.time) : 'All day'}</span>
                  {ev.tag && <span className="c-tag" title={tagLabel(ev.tag)}>{ev.tag}</span>}
                  <span className="event-title">{ev.title}</span>
                </button>
                <PaperToggle
                  on={!!ev.onPaper}
                  label={ev.title}
                  onChange={(on) => apply((s) => updateEvent(s, ev.id, { onPaper: on }))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="list" aria-label="Prioritized daily task list">
        <div className="list-head">
          <h2>Prioritized Daily Task List</h2>
          <span className="muted small">
            {tasks.filter((t) => t.status === 'done').length} of {tasks.filter((t) => t.status !== 'cancelled').length} done
            {notOnPaper > 0 && ` · ${notOnPaper} not on paper yet`}
          </span>
        </div>

        <div className="cols" aria-hidden="true">
          <span className="c-tag" />
          <span className="c-del" />
          <span className="c-status">✓</span>
          <span className="c-rank">ABC</span>
          <span className="c-title" />
          <span className="c-paper" title="On paper">✎</span>
        </div>

        {tasks.length === 0 && (
          <p className="empty">No tasks on this day yet. Add your first one below, starting with what you must do.</p>
        )}

        <ul className="rows">
          {tasks.map((t, i) => {
            const firstOfLetter = i === 0 || tasks[i - 1].priority !== t.priority;
            const gTitle = goalTitle(t.goalId);
            return (
              <li key={t.id} className={`row status-${t.status}${firstOfLetter && i > 0 ? ' letter-break' : ''}`}>
                <span className="c-tag" title={tagLabel(t.tag)}>
                  {t.tag}
                </span>
                <span className="c-del">
                  {t.delegatee && (
                    <span className="initials" title={`Delegated to ${t.delegatee}`}>
                      {t.delegatee}
                    </span>
                  )}
                </span>
                <button
                  className="c-status status-btn"
                  onClick={() => cycle(t)}
                  aria-label={`${t.title}: ${statusLabel(t.status)}. Tap to change.`}
                >
                  <StatusMark status={t.status} />
                </button>
                <span className={`c-rank rank prio-${t.priority}`}>
                  {settings.prioritySymbols[t.priority]}
                  {t.rank}
                </span>
                <button className="c-title title-btn" onClick={() => setOpenId(t.id)}>
                  <span className="title-stack">
                    <span className="title-text">{t.title}</span>
                    {gTitle && <span className="goal-line">◎ {gTitle}</span>}
                  </span>
                </button>
                <span className="c-side">
                  {t.history.length > 0 && t.status !== 'forwarded' && (
                    <span className="fwd-count" title={`Forwarded ${t.history.length} ${t.history.length === 1 ? 'time' : 'times'}`}>
                      ↪{t.history.length}
                    </span>
                  )}
                  {t.status === 'forwarded' && t.forwardedTo && (
                    <button
                      type="button"
                      className="side-fwd"
                      onClick={() => setDate(t.forwardedTo!)}
                      aria-label={`Forwarded to ${formatLong(t.forwardedTo)}. Go to that day.`}
                    >
                      <span>to</span>
                      {new Date(t.forwardedTo + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </button>
                  )}
                  {t.photos && t.photos.length > 0 && <RowThumb ids={t.photos} onOpen={() => setOpenId(t.id)} />}
                  {t.status !== 'forwarded' && (
                    <PaperToggle
                      on={!!t.onPaper}
                      label={t.title}
                      onChange={(on) => apply((s) => updateTask(s, t.id, { onPaper: on }))}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <form className="add" onSubmit={add}>
          <div className="seg" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={newPriority === p}
                className={newPriority === p ? 'on' : ''}
                onClick={() => setNewPriority(p)}
                title={p === 'A' ? 'Must' : p === 'B' ? 'Should' : 'Want'}
              >
                {settings.prioritySymbols[p]}
              </button>
            ))}
          </div>
          {settings.tags.length > 0 && (
            <TagSelect id="new-tag" className="tag-select" value={newTag} onChange={setNewTag} tags={settings.tags} emptyLabel="Tag" />
          )}
          {activeGoals.length > 0 && (
            <select
              id="new-goal"
              className="tag-select goal-select"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              aria-label="Goal"
            >
              <option value="">Goal</option>
              {activeGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.tag ? `${g.tag} · ` : ''}
                  {g.title}
                </option>
              ))}
            </select>
          )}
          <input
            id="new-title"
            ref={titleRef}
            className="add-title"
            placeholder="Add a task"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoComplete="off"
          />
          <button className="btn primary" type="submit" disabled={!newTitle.trim()}>
            Add
          </button>
        </form>
      </section>

      <section className="forward-all">
        <div>
          <h2>End of day</h2>
          <p className="muted small">
            {unfinished.length === 0
              ? 'Nothing left to forward.'
              : `${unfinished.length} unfinished ${unfinished.length === 1 ? 'task' : 'tasks'}. Each keeps its letter and goes to the top of it.`}
          </p>
        </div>
        <div className="forward-controls">
          <input
            id="forward-all-date"
            type="date"
            value={forwardTo}
            onChange={(e) => setForwardTo(e.target.value)}
            aria-label="Forward to date"
          />
          <button
            className="btn primary"
            disabled={unfinished.length === 0 || !forwardTo || forwardTo === date}
            onClick={forwardAll}
          >
            Forward unfinished →
          </button>
        </div>
      </section>

      {toast && (
        <div className="toast" role="status">
          {toast.text}{' '}
          <button className="link light" onClick={() => setDate(toast.date)}>
            View
          </button>
        </div>
      )}

      {openTask && (
        <TaskDetail
          key={openTask.id}
          task={openTask}
          state={state}
          apply={apply}
          onClose={() => setOpenId(null)}
          onGoTo={(d) => {
            setOpenId(null);
            setDate(d);
          }}
          onOpenGoal={(g) => {
            setOpenId(null);
            onOpenGoal(g);
          }}
        />
      )}

      {eventEdit && (
        <EventDialog
          state={state}
          apply={apply}
          event={eventEdit === 'new' ? undefined : eventEdit}
          defaultDate={date}
          onClose={() => setEventEdit(null)}
        />
      )}
    </>
  );
}
