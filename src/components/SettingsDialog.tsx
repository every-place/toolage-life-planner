import { useEffect, useRef, useState } from 'react';
import { PRIORITIES, type MarginTag, type PlannerState, type Priority, type Settings } from '../lib/model';
import { normalize } from '../lib/store';

interface Props {
  state: PlannerState;
  onSave: (settings: Settings) => void;
  onImport: (state: PlannerState) => void;
  onClose: () => void;
}

function tagsToText(tags: MarginTag[]) {
  return tags.map((t) => `${t.letter} = ${t.label}`).join('\n');
}

function textToTags(text: string): MarginTag[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [letter, ...rest] = line.split('=');
      return { letter: letter.trim().slice(0, 2).toUpperCase(), label: rest.join('=').trim() || letter.trim() };
    })
    .filter((t) => t.letter);
}

export function SettingsDialog({ state, onSave, onImport, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [daily, setDaily] = useState(state.settings.dailyTasks.join('\n'));
  const [tags, setTags] = useState(tagsToText(state.settings.tags));
  const [symbols, setSymbols] = useState(state.settings.prioritySymbols);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const save = () => {
    onSave({
      dailyTasks: daily.split('\n').map((s) => s.trim()).filter(Boolean),
      tags: textToTags(tags),
      prioritySymbols: {
        A: symbols.A.trim() || 'A',
        B: symbols.B.trim() || 'B',
        C: symbols.C.trim() || 'C',
      },
    });
    onClose();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lifeplanner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importData = async (file: File) => {
    try {
      const data = normalize(JSON.parse(await file.text()));
      onImport(data);
      setMessage(`Restored ${data.tasks.length} tasks from ${file.name}.`);
    } catch {
      setMessage('That file is not a LifePlanner backup. Choose a .json file saved from Back up.');
    }
  };

  return (
    <dialog ref={ref} className="sheet" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <header className="sheet-head">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <label className="field">
          <span>Daily tasks at the top of every page, one per line</span>
          <textarea id="set-daily" rows={6} value={daily} onChange={(e) => setDaily(e.target.value)} />
        </label>

        <label className="field">
          <span>Margin tags, one per line, like "B = Boeing"</span>
          <textarea id="set-tags" rows={3} value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>

        <fieldset className="field">
          <legend>Priority symbols</legend>
          <div className="field-row">
            {PRIORITIES.map((p: Priority) => (
              <label key={p} className="field narrow">
                <span>{p === 'A' ? 'Must' : p === 'B' ? 'Should' : 'Want'}</span>
                <input
                  id={`set-sym-${p}`}
                  value={symbols[p]}
                  maxLength={2}
                  onChange={(e) => setSymbols({ ...symbols, [p]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <p className="muted small">Use any letter or emoji, for example ♥ for Must.</p>
        </fieldset>

        <fieldset className="field">
          <legend>Backup</legend>
          <p className="muted small">
            Your planner is saved in this browser. Back it up now and then, until sync between phone and computer is added.
          </p>
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={exportData}>
              Back up
            </button>
            <label className="btn ghost file-btn">
              Restore from file
              <input id="set-import" type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            </label>
          </div>
          {message && <p className="small" role="status">{message}</p>}
        </fieldset>

        <footer className="sheet-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </footer>
      </form>
    </dialog>
  );
}
