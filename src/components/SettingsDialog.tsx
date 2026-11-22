import { useEffect, useRef, useState } from 'react';
import { PRIORITIES, type MarginTag, type PlannerState, type Priority, type Settings } from '../lib/model';
import { normalize } from '../lib/store';
import { exportPhotos, importPhotos } from '../lib/photos';

interface Props {
  state: PlannerState;
  onSave: (settings: Settings) => void;
  onImport: (state: PlannerState) => void;
  onClose: () => void;
}

/** Cleans the tag rows: trims, upper-cases letters, drops blanks and repeated letters. */
function cleanTags(rows: MarginTag[]): MarginTag[] {
  const seen = new Set<string>();
  const out: MarginTag[] = [];
  for (const r of rows) {
    const letter = r.letter.trim().toUpperCase().slice(0, 2);
    if (!letter || seen.has(letter)) continue;
    seen.add(letter);
    out.push({ letter, label: r.label.trim() || letter });
  }
  return out;
}

export function SettingsDialog({ state, onSave, onImport, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [daily, setDaily] = useState(state.settings.dailyTasks.join('\n'));
  const [tags, setTags] = useState<MarginTag[]>(() => state.settings.tags.map((t) => ({ ...t })));
  const [symbols, setSymbols] = useState(state.settings.prioritySymbols);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const save = () => {
    onSave({
      dailyTasks: daily.split('\n').map((s) => s.trim()).filter(Boolean),
      tags: cleanTags(tags),
      prioritySymbols: {
        A: symbols.A.trim() || 'A',
        B: symbols.B.trim() || 'B',
        C: symbols.C.trim() || 'C',
      },
    });
    onClose();
  };

  const exportData = async () => {
    setMessage('Preparing backup…');
    const ids = state.tasks.flatMap((t) => t.photos ?? []);
    const photos = await exportPhotos(ids).catch(() => ({}));
    const blob = new Blob([JSON.stringify({ ...state, photos }, null, 2)], { type: 'application/json' });
    setMessage(`Backup saved with ${Object.keys(photos).length} photos.`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lifeplanner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importData = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const data = normalize(raw);
      const n = raw && typeof raw.photos === 'object' ? await importPhotos(raw.photos) : 0;
      onImport(data);
      setMessage(`Restored ${data.tasks.length} tasks and ${n} photos from ${file.name}.`);
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

        <fieldset className="field" id="set-tags">
          <legend>Margin letters</legend>
          <p className="muted small">The letter you write in the left margin and what it stands for.</p>
          <div className="tag-rows">
            {tags.map((t, i) => (
              <div className="tag-row" key={i}>
                <input
                  id={`set-tag-letter-${i}`}
                  className="tag-letter"
                  value={t.letter}
                  maxLength={2}
                  aria-label="Letter"
                  onChange={(e) => setTags(tags.map((x, j) => (j === i ? { ...x, letter: e.target.value } : x)))}
                />
                <input
                  id={`set-tag-label-${i}`}
                  className="tag-label"
                  value={t.label}
                  placeholder="What it stands for"
                  aria-label="Stands for"
                  onChange={(e) => setTags(tags.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <button type="button" className="mini" aria-label={`Remove ${t.letter || 'tag'}`} onClick={() => setTags(tags.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div>
            <button type="button" className="btn ghost small-btn" onClick={() => setTags([...tags, { letter: '', label: '' }])}>
              + Add letter
            </button>
          </div>
          <p className="muted small">Removing a letter here keeps it on tasks that already have it.</p>
        </fieldset>

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
