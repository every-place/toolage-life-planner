import { useEffect, useRef, useState } from 'react';
import { addEvent, deleteEvent, updateEvent, type PlannerEvent, type PlannerState } from '../lib/model';

interface Props {
  state: PlannerState;
  apply: (fn: (s: PlannerState) => PlannerState) => void;
  event?: PlannerEvent;
  defaultDate: string;
  onClose: () => void;
}

export function EventDialog({ state, apply, event, defaultDate, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [time, setTime] = useState(event?.time ?? '');
  const [tag, setTag] = useState(event?.tag ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    if (event) {
      apply((s) =>
        updateEvent(s, event.id, {
          title: title.trim(),
          date,
          time: time || undefined,
          tag: tag || undefined,
          notes: notes.trim() || undefined,
        }),
      );
    } else {
      apply((s) => addEvent(s, { title, date, time, tag, notes }));
    }
    onClose();
  };

  return (
    <dialog ref={ref} className="sheet" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <form className="sheet-body" onSubmit={save}>
        <header className="sheet-head">
          <h2>{event ? 'Edit event' : 'New event'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <label className="field">
          <span>What</span>
          <input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Dentist, birthday, team offsite" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Time (optional)</span>
            <input id="event-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          {state.settings.tags.length > 0 && (
            <label className="field">
              <span>Margin tag</span>
              <select id="event-tag" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">None</option>
                {state.settings.tags.map((t) => (
                  <option key={t.letter} value={t.letter}>
                    {t.letter} · {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea id="event-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <footer className="sheet-foot">
          {event &&
            (confirmDelete ? (
              <>
                <span className="small">Delete this event?</span>
                <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    apply((s) => deleteEvent(s, event.id));
                    onClose();
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            ))}
          {!confirmDelete && (
            <button type="submit" className="btn primary" disabled={!title.trim() || !date}>
              Save
            </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
