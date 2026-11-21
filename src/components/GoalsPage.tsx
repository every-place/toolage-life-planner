import { useEffect, useState } from 'react';
import { formatShort, today } from '../lib/dates';
import {
  PRIORITIES,
  addGoal,
  addStep,
  deleteGoal,
  deleteStep,
  goalProgress,
  moveStep,
  rankLabel,
  scheduleStep,
  setStepDone,
  taskForStep,
  updateGoal,
  updateStep,
  type Goal,
  type GoalStep,
  type PlannerState,
  type Priority,
} from '../lib/model';

interface Props {
  state: PlannerState;
  apply: (fn: (s: PlannerState) => PlannerState) => void;
  focusGoalId?: string;
  onGoTo: (date: string) => void;
}

const UNTAGGED = '__none';

export function GoalsPage({ state, apply, focusGoalId, onGoTo }: Props) {
  const { settings } = state;
  const [filter, setFilter] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  const [target, setTarget] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(focusGoalId ? [focusGoalId] : []));

  useEffect(() => {
    if (!focusGoalId) return;
    setOpenIds((s) => new Set(s).add(focusGoalId));
    requestAnimationFrame(() => document.getElementById(`goal-${focusGoalId}`)?.scrollIntoView({ block: 'start' }));
  }, [focusGoalId]);

  const goals = state.goals
    .filter((g) => showDone || !g.done)
    .filter((g) => !filter || (filter === UNTAGGED ? !g.tag : g.tag === filter))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'));

  const toggle = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    apply((s) => {
      const next = addGoal(s, { title, tag, targetDate: target });
      const created = next.goals[next.goals.length - 1];
      setOpenIds((o) => new Set(o).add(created.id));
      return next;
    });
    setTitle('');
    setTarget('');
  };

  const doneCount = state.goals.filter((g) => g.done).length;

  return (
    <>
      <div className="page-head">
        <h1>Goals</h1>
        <p className="muted small">Break each goal into steps, then put a step on a day to make it a task.</p>
      </div>

      <form className="card add-goal" onSubmit={create}>
        <input
          id="goal-title"
          className="add-title"
          placeholder="New goal, like “Launch the EveryPlace website”"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {settings.tags.length > 0 && (
          <select id="goal-tag" className="tag-select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Margin tag">
            <option value="">Tag</option>
            {settings.tags.map((t) => (
              <option key={t.letter} value={t.letter}>
                {t.letter} · {t.label}
              </option>
            ))}
          </select>
        )}
        <input id="goal-target" type="date" className="date-input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target date" />
        <button className="btn primary" type="submit" disabled={!title.trim()}>
          Add goal
        </button>
      </form>

      <div className="filters">
        <label className="filter">
          <span className="muted small">Show</span>
          <select id="goal-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All goals</option>
            {settings.tags.map((t) => (
              <option key={t.letter} value={t.letter}>
                {t.letter} · {t.label}
              </option>
            ))}
            <option value={UNTAGGED}>Personal (no tag)</option>
          </select>
        </label>
        {doneCount > 0 && (
          <label className="check small">
            <input id="goal-show-done" type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show {doneCount} reached
          </label>
        )}
      </div>

      {goals.length === 0 ? (
        <p className="empty card">
          {state.goals.length === 0 ? 'No goals yet. Add one above, then list the steps that get you there.' : 'No goals match this filter.'}
        </p>
      ) : (
        <ul className="goal-list">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              state={state}
              apply={apply}
              open={openIds.has(g.id)}
              onToggle={() => toggle(g.id)}
              onGoTo={onGoTo}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function GoalCard({
  goal,
  state,
  apply,
  open,
  onToggle,
  onGoTo,
}: {
  goal: Goal;
  state: PlannerState;
  apply: Props['apply'];
  open: boolean;
  onToggle: () => void;
  onGoTo: (d: string) => void;
}) {
  const { settings } = state;
  const { done, total } = goalProgress(goal);
  const [newStep, setNewStep] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tagLabel = settings.tags.find((t) => t.letter === goal.tag)?.label;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <li id={`goal-${goal.id}`} className={`card goal${goal.done ? ' goal-done' : ''}`}>
      <button className="goal-head" onClick={onToggle} aria-expanded={open}>
        <span className="c-tag goal-tag" title={tagLabel}>
          {goal.tag ?? ''}
        </span>
        <span className="goal-main">
          <span className="goal-title">{goal.title}</span>
          <span className="muted small">
            {total ? `${done} of ${total} steps` : 'No steps yet'}
            {goal.targetDate ? ` · by ${formatShort(goal.targetDate)}` : ''}
            {goal.done ? ' · reached' : ''}
          </span>
          {total > 0 && (
            <span className="bar" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
        <span className="chev" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="goal-body">
          {editing ? (
            <GoalEditor goal={goal} state={state} apply={apply} onDone={() => setEditing(false)} />
          ) : (
            goal.why && <p className="why">{goal.why}</p>
          )}

          <ol className="steps">
            {goal.steps.map((st, i) => (
              <StepRow
                key={st.id}
                goal={goal}
                step={st}
                index={i}
                state={state}
                apply={apply}
                onGoTo={onGoTo}
              />
            ))}
          </ol>

          <form
            className="add-step"
            onSubmit={(e) => {
              e.preventDefault();
              apply((s) => addStep(s, goal.id, newStep));
              setNewStep('');
            }}
          >
            <input
              id={`new-step-${goal.id}`}
              className="add-title"
              placeholder="Add a step"
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
            />
            <button className="btn ghost" type="submit" disabled={!newStep.trim()}>
              Add step
            </button>
          </form>

          <div className="goal-actions">
            {confirmDelete ? (
              <>
                <span className="small">Delete this goal? Its tasks stay on their days.</span>
                <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button className="btn danger" onClick={() => apply((s) => deleteGoal(s, goal.id))}>
                  Delete
                </button>
              </>
            ) : (
              <>
                <button className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
                {!editing && (
                  <button className="btn ghost" onClick={() => setEditing(true)}>
                    Edit goal
                  </button>
                )}
                <button className="btn ghost" onClick={() => apply((s) => updateGoal(s, goal.id, { done: !goal.done }))}>
                  {goal.done ? 'Reopen goal' : 'Mark goal reached'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function GoalEditor({ goal, state, apply, onDone }: { goal: Goal; state: PlannerState; apply: Props['apply']; onDone: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [why, setWhy] = useState(goal.why ?? '');
  const [tag, setTag] = useState(goal.tag ?? '');
  const [target, setTarget] = useState(goal.targetDate ?? '');
  return (
    <form
      className="goal-editor"
      onSubmit={(e) => {
        e.preventDefault();
        apply((s) =>
          updateGoal(s, goal.id, {
            title: title.trim() || goal.title,
            why: why.trim() || undefined,
            tag: tag || undefined,
            targetDate: target || undefined,
          }),
        );
        onDone();
      }}
    >
      <label className="field">
        <span>Goal</span>
        <input id={`edit-goal-title-${goal.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Margin tag</span>
          <select id={`edit-goal-tag-${goal.id}`} value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">None</option>
            {state.settings.tags.map((t) => (
              <option key={t.letter} value={t.letter}>
                {t.letter} · {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Target date</span>
          <input id={`edit-goal-target-${goal.id}`} type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Why it matters</span>
        <textarea id={`edit-goal-why-${goal.id}`} rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
      </label>
      <div className="btn-row end">
        <button type="button" className="btn ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Save
        </button>
      </div>
    </form>
  );
}

function StepRow({
  goal,
  step,
  index,
  state,
  apply,
  onGoTo,
}: {
  goal: Goal;
  step: GoalStep;
  index: number;
  state: PlannerState;
  apply: Props['apply'];
  onGoTo: (d: string) => void;
}) {
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState(today());
  const [priority, setPriority] = useState<Priority>('A');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(step.title);
  const task = taskForStep(state, step.id);
  const sym = state.settings.prioritySymbols;

  return (
    <li className={`step${step.done ? ' step-done' : ''}`}>
      <div className="step-line">
        <input
          id={`step-done-${step.id}`}
          type="checkbox"
          checked={step.done}
          onChange={(e) => apply((s) => setStepDone(s, goal.id, step.id, e.target.checked))}
          aria-label={`Step ${index + 1} done`}
        />
        {editing ? (
          <form
            className="step-edit"
            onSubmit={(e) => {
              e.preventDefault();
              apply((s) => updateStep(s, goal.id, step.id, text));
              setEditing(false);
            }}
          >
            <input id={`step-text-${step.id}`} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <button className="btn ghost small-btn" type="submit">
              Save
            </button>
          </form>
        ) : (
          <button className="step-title" onClick={() => setEditing(true)} title="Edit step">
            {step.title}
          </button>
        )}
        <span className="step-tools">
          <button className="mini" onClick={() => apply((s) => moveStep(s, goal.id, step.id, -1))} aria-label="Move step up">
            ↑
          </button>
          <button className="mini" onClick={() => apply((s) => moveStep(s, goal.id, step.id, 1))} aria-label="Move step down">
            ↓
          </button>
          <button className="mini" onClick={() => apply((s) => deleteStep(s, goal.id, step.id))} aria-label="Delete step">
            ✕
          </button>
        </span>
      </div>
      <div className="step-sched">
        {task ? (
          <span className="small muted">
            On{' '}
            <button className="link" onClick={() => onGoTo(task.date)}>
              {formatShort(task.date)}
            </button>{' '}
            as {sym[task.priority]}
            {task.rank}
            {task.status === 'forwarded' ? ' (forwarded)' : ''}
            {task.history.length > 0 ? ` · forwarded ${task.history.length}×` : ''}
            <span className="sr-only">{rankLabel(task)}</span>
          </span>
        ) : (
          !step.done &&
          !scheduling && (
            <button className="link small" onClick={() => setScheduling(true)}>
              Put on a day
            </button>
          )
        )}
        {scheduling && (
          <form
            className="sched-form"
            onSubmit={(e) => {
              e.preventDefault();
              apply((s) => scheduleStep(s, goal.id, step.id, date, priority));
              setScheduling(false);
            }}
          >
            <input id={`sched-date-${step.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Day" />
            <div className="seg small-seg" role="radiogroup" aria-label="Priority">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  className={priority === p ? 'on' : ''}
                  onClick={() => setPriority(p)}
                >
                  {sym[p]}
                </button>
              ))}
            </div>
            <button className="btn primary small-btn" type="submit" disabled={!date}>
              Add to day
            </button>
            <button className="btn ghost small-btn" type="button" onClick={() => setScheduling(false)}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
