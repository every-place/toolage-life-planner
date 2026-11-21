import { useMemo, useState } from 'react';
import { addMonths, formatLong, formatMonth, formatTime, fromDayKey, monthGrid, monthOf, today } from '../lib/dates';
import { eventsForDay, isUnfinished, type PlannerEvent, type PlannerState } from '../lib/model';
import { EventDialog } from './EventDialog';

interface Props {
  state: PlannerState;
  apply: (fn: (s: PlannerState) => PlannerState) => void;
  month: string;
  setMonth: (m: string) => void;
  onOpenDay: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MonthPage({ state, apply, month, setMonth, onOpenDay }: Props) {
  const todayKey = today();
  const [selected, setSelected] = useState(monthOf(todayKey) === month ? todayKey : `${month}-01`);
  const [eventEdit, setEventEdit] = useState<PlannerEvent | 'new' | null>(null);
  const cells = useMemo(() => monthGrid(month), [month]);

  const changeMonth = (n: number) => {
    const m = addMonths(month, n);
    setMonth(m);
    setSelected(monthOf(todayKey) === m ? todayKey : `${m}-01`);
  };

  const selEvents = eventsForDay(state, selected);
  const selTasks = state.tasks.filter((t) => t.date === selected);
  const selOpen = selTasks.filter(isUnfinished).length;

  return (
    <>
      <nav className="daynav" aria-label="Choose month">
        <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <div className="daytitle">
          <h1>{formatMonth(month)}</h1>
          {monthOf(todayKey) !== month && (
            <p className="muted small">
              <button
                className="link"
                onClick={() => {
                  setMonth(monthOf(todayKey));
                  setSelected(todayKey);
                }}
              >
                This month
              </button>
            </p>
          )}
        </div>
        <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="Next month">
          ›
        </button>
      </nav>

      <div className="month card" role="grid" aria-label={formatMonth(month)}>
        <div className="month-row weekdays" role="row">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader">
              {w}
            </span>
          ))}
        </div>
        <div className="month-cells">
          {cells.map((key) => {
            const inMonth = monthOf(key) === month;
            const evs = eventsForDay(state, key);
            const open = state.tasks.filter((t) => t.date === key && isUnfinished(t)).length;
            const cls = ['cell', inMonth ? '' : 'out', key === todayKey ? 'today' : '', key === selected ? 'sel' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={key}
                className={cls}
                role="gridcell"
                aria-selected={key === selected}
                aria-label={`${formatLong(key)}: ${evs.length} events, ${open} open tasks`}
                onClick={() => setSelected(key)}
                onDoubleClick={() => onOpenDay(key)}
              >
                <span className="cell-day">{fromDayKey(key).getDate()}</span>
                <span className="cell-events">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className="cell-ev">
                      {e.title}
                    </span>
                  ))}
                  {evs.length > 3 && <span className="cell-more">+{evs.length - 3}</span>}
                </span>
                <span className="cell-dots" aria-hidden="true">
                  {evs.length > 0 && <span className="dot ev" />}
                  {open > 0 && <span className="dot task" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="card day-peek" aria-label={`Selected day, ${formatLong(selected)}`}>
        <div className="list-head">
          <h2>{formatLong(selected)}</h2>
        </div>
        {selEvents.length === 0 ? (
          <p className="muted small">No events. Add one here and it will show on that day’s page.</p>
        ) : (
          <ul className="event-list">
            {selEvents.map((ev) => (
              <li key={ev.id}>
                <button className="event-btn" onClick={() => setEventEdit(ev)}>
                  <span className="event-time">{ev.time ? formatTime(ev.time) : 'All day'}</span>
                  {ev.tag && <span className="c-tag">{ev.tag}</span>}
                  <span className="event-title">{ev.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          {selTasks.length === 0 ? 'No tasks planned.' : `${selTasks.length} tasks planned, ${selOpen} still open.`}
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => setEventEdit('new')}>
            Add event
          </button>
          <button className="btn ghost" onClick={() => onOpenDay(selected)}>
            Open day page
          </button>
        </div>
      </section>

      {eventEdit && (
        <EventDialog
          state={state}
          apply={apply}
          event={eventEdit === 'new' ? undefined : eventEdit}
          defaultDate={selected}
          onClose={() => setEventEdit(null)}
        />
      )}
    </>
  );
}
