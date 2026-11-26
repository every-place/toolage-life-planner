import { useEffect, useRef, useState } from 'react';
import { PRIORITIES, type MarginTag, type PlannerState, type Priority, type Settings } from '../lib/model';
import { normalize } from '../lib/store';
import { exportPhotos, importPhotos } from '../lib/photos';
import type { Cloud } from '../lib/cloud';
import { claudeInstructions, curlExample, generateKey, intakeUrl, registerKey, revokeKey } from '../lib/intake';
import { ImportDialog } from './ImportDialog';

interface Props {
  state: PlannerState;
  cloud: Cloud;
  apply: (fn: (s: PlannerState) => PlannerState) => void;
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

export function SettingsDialog({ state, cloud, apply, onSave, onImport, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [daily, setDaily] = useState(state.settings.dailyTasks.join('\n'));
  const [tags, setTags] = useState<MarginTag[]>(() => state.settings.tags.map((t) => ({ ...t })));
  const [symbols, setSymbols] = useState(state.settings.prioritySymbols);
  const [message, setMessage] = useState('');
  const [inboxMsg, setInboxMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const intakeKey = state.settings.intakeKey;

  const setKey = (key: string | undefined) =>
    apply((s) => ({ ...s, settings: { ...s.settings, intakeKey: key } }));

  /** Turns on a new key (replacing the old one, which stops working). */
  const newKey = async () => {
    if (!cloud.user) return;
    setBusy(true);
    setInboxMsg('');
    try {
      const key = generateKey();
      await registerKey(cloud.user.uid, key);
      if (intakeKey) await revokeKey(intakeKey).catch(() => undefined);
      setKey(key);
      setInboxMsg(intakeKey ? 'New key made. The old one no longer works; update anything that used it.' : 'Task inbox is on.');
    } catch {
      setInboxMsg('Could not turn on the inbox. Check that the latest Firestore rules from the README are published.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!intakeKey) return;
    setBusy(true);
    await revokeKey(intakeKey).catch(() => undefined);
    setKey(undefined);
    setBusy(false);
    setInboxMsg('Task inbox is off. Tasks sent with the old key are refused.');
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setInboxMsg(`${what} copied.`);
    } catch {
      setInboxMsg('Copying is blocked here. Select the text below and copy it yourself.');
    }
  };

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const save = () => {
    onSave({
      ...state.settings,
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

        <fieldset className="field" id="set-sync">
          <legend>Sync</legend>
          {cloud.user ? (
            <>
              <p className="small">
                Syncing as <b>{cloud.user.email}</b>.{' '}
                {cloud.status === 'connecting' ? 'Connecting…' : cloud.status === 'synced' ? 'Up to date.' : ''}
              </p>
              <p className="muted small">Sign in with the same Google account on your phone and computer and they share one planner.</p>
              <div>
                <button type="button" className="btn ghost small-btn" onClick={() => cloud.signOut()}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted small">
                Sign in with Google to share this planner between your phone and computer. What’s on this device is added to
                your cloud copy the first time.
              </p>
              <div>
                <button type="button" className="btn primary small-btn" disabled={!cloud.ready} onClick={() => cloud.signIn()}>
                  Sign in with Google
                </button>
              </div>
            </>
          )}
          {cloud.error && (
            <p className="small danger-text" role="alert">
              {cloud.error}
            </p>
          )}
        </fieldset>

        <fieldset className="field" id="set-inbox">
          <legend>Task inbox</legend>
          <p className="muted small">
            Let other systems, like your Claude projects, send tasks to your inbox. They show up above the task list without a
            priority, for you to letter while planning.
          </p>
          {!cloud.user ? (
            <p className="muted small">Sign in above to get an address other systems can send tasks to.</p>
          ) : intakeKey ? (
            <>
              <p className="small">
                On. Tasks arrive whenever LifePlanner is open on one of your devices.
              </p>
              <div className="btn-row">
                <button type="button" className="btn primary small-btn" onClick={() => copy(claudeInstructions(intakeKey, state.settings.tags), 'Instructions for Claude')}>
                  Copy instructions for Claude
                </button>
                <button type="button" className="btn ghost small-btn" onClick={() => copy(intakeUrl(intakeKey), 'Address')}>
                  Copy address
                </button>
                <button type="button" className="btn ghost small-btn" onClick={() => copy(curlExample(intakeKey, state.settings.tags), 'Example')}>
                  Copy example
                </button>
              </div>
              <p className="muted small">
                Paste the instructions into a Claude project’s instructions; then ask it to send tasks to your planner. The key
                in the address lets anyone who has it add tasks (but never read them), so keep it private.
              </p>
              <details className="small">
                <summary>Show address</summary>
                <code className="inbox-url">{intakeUrl(intakeKey)}</code>
              </details>
              <div className="btn-row">
                <button type="button" className="btn ghost small-btn" disabled={busy} onClick={newKey}>
                  Make a new key
                </button>
                <button type="button" className="btn ghost small-btn" disabled={busy} onClick={turnOff}>
                  Turn off
                </button>
              </div>
            </>
          ) : (
            <div>
              <button type="button" className="btn primary small-btn" disabled={busy} onClick={newKey}>
                Turn on task inbox
              </button>
            </div>
          )}
          <div>
            <button type="button" className="btn ghost small-btn" onClick={() => setImporting(true)}>
              Import tasks from a list or file…
            </button>
          </div>
          {inboxMsg && <p className="small" role="status">{inboxMsg}</p>}
        </fieldset>

        <fieldset className="field">
          <legend>Backup</legend>
          <p className="muted small">
            {cloud.user
              ? 'A backup file is a snapshot you keep yourself. Restoring one while signed in replaces the planner on every device.'
              : 'Your planner is saved in this browser. Back it up now and then, or sign in above to sync.'}
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
      {importing && <ImportDialog state={state} apply={apply} onClose={() => setImporting(false)} />}
    </dialog>
  );
}
