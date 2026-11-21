import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, dayOfYear, daysLeftInYear, formatLong, today } from './lib/dates';
import {
  PRIORITIES,
  addTask,
  dailyStatus,
  forwardUnfinished,
  isUnfinished,
  nextStatus,
  setDailyStatus,
  tasksForDay,
  updateSettings,
  updateTask,
  type Priority,
  type Task,
} from './lib/model';
import { usePlanner } from './lib/store';
import { StatusMark, statusLabel } from './components/StatusMark';
import { TaskDetail } from './components/TaskDetail';
import { SettingsDialog } from './components/SettingsDialog';

const DAY_RE = /^#(\d{4}-\d{2}-\d{2})$/;

function dateFromHash(): string {
  const m = DAY_RE.exec(window.location.hash);
  return m ? m[1] : today();
}

export default function App() {
  const { state, apply, replace } = usePlanner();
  const [date, setDate] = useState(dateFromHash);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('A');
  const [newTag, setNewTag] = useState('');
  const [forwardTo, setForwardTo] = useState(addDays(date, 1));
  const [toast, setToast] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const { settings } = state;

  useEffect(() => {
    const onHash = () => setDate(dateFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const want = date === today() ? '' : `#${date}`;
    if (window.location.hash !== want) history.replaceState(null, '', want || window.location.pathname);
    setForwardTo(addDays(date, 1));
  }, [date]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const tasks = useMemo(() => tasksForDay(state, date), [state, date]);
  const unfinished = tasks.filter(isUnfinished);
  const openTask = openId ? state.tasks.find((t) => t.id === openId) : undefined;
  const isToday = date === today();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    apply((s) => addTask(s, { title: newTitle, date, priority: newPriority, tag: newTag }));
    setNewTitle('');
    titleRef.current?.focus();
  };

  const cycle = (t: Task) => {
    if (t.status === 'forwarded') {
      setOpenId(t.id);
      return;
    }
    apply((s) => updateTask(s, t.id, { status: nextStatus(t.status) }));
  };

  const forwardAll = () => {
    const n = unfinished.length;
    apply((s) => forwardUnfinished(s, date, forwardTo));
    setToast(`Forwarded ${n} ${n === 1 ? 'task' : 'tasks'} to ${formatLong(forwardTo)}.`);
  };

  const tagLabel = (letter?: string) => settings.tags.find((t) => t.letter === letter)?.label ?? '';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="36" height="36" />
          <span className="wordmark">
            <b>Life</b>
            <i>Planner</i>
          </span>
          <span className="by">
            by <b>Toolage</b>
          </span>
        </div>
        <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.1.1-1.4-.1-1.4 2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4L14.2 2.6h-4l-.4 2.6a7 7 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.6-.1 1.4.1 1.4-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.4 2.6h4l.4-2.6a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <main className="page">
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

        <section className="list" aria-label="Prioritized daily task list">
          <div className="list-head">
            <h2>Prioritized Daily Task List</h2>
            <span className="muted small">
              {tasks.filter((t) => t.status === 'done').length} of {tasks.length} done
            </span>
          </div>

          <div className="cols" aria-hidden="true">
            <span className="c-tag" />
            <span className="c-del" />
            <span className="c-status">✓</span>
            <span className="c-rank">ABC</span>
            <span className="c-title" />
          </div>

          {tasks.length === 0 && (
            <p className="empty">No tasks on this day yet. Add your first one below, starting with what you must do.</p>
          )}

          <ul className="rows">
            {tasks.map((t, i) => {
              const firstOfLetter = i === 0 || tasks[i - 1].priority !== t.priority;
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
                  <button className="c-status status-btn" onClick={() => cycle(t)} aria-label={`${t.title}: ${statusLabel(t.status)}. Tap to change.`}>
                    <StatusMark status={t.status} />
                  </button>
                  <span className={`c-rank rank prio-${t.priority}`}>
                    {settings.prioritySymbols[t.priority]}
                    {t.rank}
                  </span>
                  <button className="c-title title-btn" onClick={() => setOpenId(t.id)}>
                    <span className="title-text">{t.title}</span>
                    {t.history.length > 0 && t.status !== 'forwarded' && (
                      <span className="fwd-count" title={`Forwarded ${t.history.length} times`}>
                        ↪{t.history.length}
                      </span>
                    )}
                    {t.status === 'forwarded' && t.forwardedTo && (
                      <span className="fwd-to">to {new Date(t.forwardedTo + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    )}
                  </button>
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
              <select id="new-tag" className="tag-select" value={newTag} onChange={(e) => setNewTag(e.target.value)} aria-label="Margin tag">
                <option value="">Tag</option>
                {settings.tags.map((t) => (
                  <option key={t.letter} value={t.letter}>
                    {t.letter} · {t.label}
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
            <input id="forward-all-date" type="date" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} aria-label="Forward to date" />
            <button className="btn primary" disabled={unfinished.length === 0 || !forwardTo || forwardTo === date} onClick={forwardAll}>
              Forward unfinished →
            </button>
          </div>
        </section>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}{' '}
          <button className="link light" onClick={() => setDate(forwardTo)}>
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
        />
      )}

      {showSettings && (
        <SettingsDialog
          state={state}
          onSave={(s) => apply((st) => updateSettings(st, s))}
          onImport={(s) => replace(s)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
