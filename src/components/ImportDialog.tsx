import { useEffect, useMemo, useRef, useState } from 'react';
import { addToInbox, parseTaskText } from '../lib/inbox';
import type { PlannerState } from '../lib/model';

interface Props {
  state: PlannerState;
  apply: (fn: (s: PlannerState) => PlannerState) => void;
  onClose: () => void;
}

/** Paste a list or choose an export file; the tasks go to the inbox. */
export function ImportDialog({ state, apply, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState('Import');
  const [message, setMessage] = useState('');
  const tasks = useMemo(() => parseTaskText(text, state.settings.tags), [text, state.settings.tags]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const readFile = async (file: File) => {
    setText(await file.text());
    setSource(file.name.replace(/\.[^.]+$/, '') || 'Import');
  };

  const add = () => {
    const from = source.trim() || 'Import';
    const n = addToInbox(state, tasks, from).added;
    apply((s) => addToInbox(s, tasks, from).state);
    setText('');
    const skipped = tasks.length - n;
    setMessage(
      `Added ${n} ${n === 1 ? 'task' : 'tasks'} to the inbox.` + (skipped ? ` Skipped ${skipped} already in your planner.` : ''),
    );
  };

  return (
    <dialog ref={ref} className="sheet" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <header className="sheet-head">
          <h2>Import tasks</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <p className="muted small">
          Paste a list, one task per line, or a JSON or CSV export from another app. Start a line with a margin letter, like{' '}
          <b>[B]</b>, to tag it. Tasks land in the inbox without a priority.
        </p>
        <label className="field">
          <span>Tasks</span>
          <textarea id="import-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Send slides to Pat\n[E] Renew business license'} />
        </label>
        <div className="field-row">
          <label className="field grow">
            <span>From</span>
            <input id="import-source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={100} />
          </label>
          <label className="btn ghost file-btn align-end">
            Choose file
            <input id="import-file" type="file" accept=".json,.csv,.txt,.md,application/json,text/csv,text/plain" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
        </div>
        {message && <p className="small" role="status">{message}</p>}
        <footer className="sheet-foot">
          <span className="muted small grow">{text.trim() ? `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} found` : ''}</span>
          <button type="button" className="btn ghost" onClick={onClose}>
            Done
          </button>
          <button type="submit" className="btn primary" disabled={tasks.length === 0}>
            Add to inbox
          </button>
        </footer>
      </form>
    </dialog>
  );
}
