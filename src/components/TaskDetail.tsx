import { TagSelect } from './TagSelect';
import { useEffect, useRef, useState } from 'react';
import { addDays, formatLong, formatShort } from '../lib/dates';
import {
  PRIORITIES,
  changePriority,
  chainOf,
  deleteTask,
  forwardTask,
  isUnfinished,
  moveTask,
  rankLabel,
  updateTask,
  type PlannerState,
  type Priority,
  type Task,
} from '../lib/model';
import { statusLabel } from './StatusMark';

interface Props {
  task: Task;
  state: PlannerState;
  apply: (fn: (s: PlannerState) => PlannerState) => void;
  onClose: () => void;
  onGoTo: (date: string) => void;
  onOpenGoal: (goalId: string) => void;
}

export function TaskDetail({ task, state, apply, onClose, onGoTo, onOpenGoal }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [delegatee, setDelegatee] = useState(task.delegatee ?? '');
  const [forwardDate, setForwardDate] = useState(addDays(task.date, 1));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { settings } = state;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? '');
    setDelegatee(task.delegatee ?? '');
  }, [task.id, task.title, task.notes, task.delegatee]);

  const save = () => {
    apply((s) =>
      updateTask(s, task.id, {
        title: title.trim() || task.title,
        notes: notes.trim() || undefined,
        delegatee: delegatee.trim().toUpperCase().slice(0, 3) || undefined,
      }),
    );
  };

  const close = () => {
    save();
    onClose();
  };

  const chain = chainOf(state, task.chainId);
  const goalStep = state.goals.find((g) => g.id === task.goalId)?.steps.find((st) => st.id === task.stepId);
  const unfinished = isUnfinished(task);

  return (
    <dialog ref={ref} className="sheet" onClose={close} onCancel={(e) => { e.preventDefault(); close(); }}>
      <form method="dialog" className="sheet-body" onSubmit={(e) => { e.preventDefault(); close(); }}>
        <header className="sheet-head">
          <span className="rank big">{settings.prioritySymbols[task.priority]}{task.rank}</span>
          <span className="muted">{statusLabel(task.status)}</span>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">✕</button>
        </header>

        <label className="field">
          <span>Task</span>
          <input id="detail-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Priority</span>
            <select
              id="detail-priority"
              value={task.priority}
              onChange={(e) => apply((s) => changePriority(s, task.id, e.target.value as Priority))}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {settings.prioritySymbols[p]} {p === 'A' ? 'Must' : p === 'B' ? 'Should' : 'Want'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Margin tag</span>
            <TagSelect id="detail-tag" value={task.tag ?? ''} onChange={(v) => apply((s) => updateTask(s, task.id, { tag: v || undefined }))} tags={settings.tags} />
          </label>
          <label className="field narrow">
            <span>Delegated to</span>
            <input
              id="detail-delegatee"
              value={delegatee}
              placeholder="Initials"
              maxLength={3}
              onChange={(e) => setDelegatee(e.target.value)}
              onBlur={save}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Goal</span>
            <select
              id="detail-goal"
              value={task.goalId ?? ''}
              onChange={(e) =>
                apply((s) => updateTask(s, task.id, { goalId: e.target.value || undefined, stepId: undefined }))
              }
            >
              <option value="">None</option>
              {state.goals
                .filter((g) => !g.done || g.id === task.goalId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.tag ? `${g.tag} · ` : ''}
                    {g.title}
                  </option>
                ))}
            </select>
          </label>
          {task.goalId && (
            <button type="button" className="btn ghost align-end" onClick={() => onOpenGoal(task.goalId!)}>
              Open goal
            </button>
          )}
        </div>
        {goalStep && <p className="muted small note">Carries out the step “{goalStep.title}”. Checking this task checks the step.</p>}

        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={() => apply((s) => moveTask(s, task.id, -1))}>
            Move up
          </button>
          <button type="button" className="btn ghost" onClick={() => apply((s) => moveTask(s, task.id, 1))}>
            Move down
          </button>
        </div>

        <label className="check small paper-note">
          <input
            id="detail-on-paper"
            type="checkbox"
            checked={!!task.onPaper}
            onChange={(e) => apply((s) => updateTask(s, task.id, { onPaper: e.target.checked }))}
          />
          On paper (written in my paper planner on this day)
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea id="detail-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={save} />
        </label>

        {unfinished && (
          <div className="forward-box">
            <label className="field">
              <span>Forward to</span>
              <input id="detail-forward-date" type="date" value={forwardDate} onChange={(e) => setForwardDate(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={!forwardDate || forwardDate === task.date}
              onClick={() => {
                save();
                apply((s) => forwardTask(s, task.id, forwardDate));
                onClose();
              }}
            >
              Forward →
            </button>
          </div>
        )}
        {task.status === 'forwarded' && task.forwardedTo && (
          <p className="note">
            Forwarded to{' '}
            <button type="button" className="link" onClick={() => onGoTo(task.forwardedTo!)}>
              {formatShort(task.forwardedTo)}
            </button>
            .
          </p>
        )}

        <section className="history">
          <h3>History</h3>
          <p className="muted small">
            Written {new Date(task.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · first
            planned for {formatLong(task.originDate)}
          </p>
          {task.history.length === 0 ? (
            <p className="muted small">Never forwarded.</p>
          ) : (
            <ol>
              {task.history.map((h, i) => (
                <li key={i}>
                  <button type="button" className="link" onClick={() => onGoTo(h.from)}>
                    {formatShort(h.from)}
                  </button>{' '}
                  <span className="muted">{h.fromRank}</span> →{' '}
                  <button type="button" className="link" onClick={() => onGoTo(h.to)}>
                    {formatShort(h.to)}
                  </button>{' '}
                  <span className="muted">{h.toRank}</span>
                </li>
              ))}
            </ol>
          )}
          {chain.length > 1 && <p className="muted small">On {chain.length} days so far.</p>}
        </section>

        <footer className="sheet-foot">
          {confirmDelete ? (
            <>
              <span className="small">Delete {rankLabel(task)} from this day?</span>
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  apply((s) => deleteTask(s, task.id));
                  onClose();
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
              <button type="submit" className="btn primary">
                Done
              </button>
            </>
          )}
        </footer>
      </form>
    </dialog>
  );
}
