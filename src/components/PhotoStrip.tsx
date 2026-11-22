import { useEffect, useRef, useState } from 'react';
import { deletePhoto, getPhoto, savePhoto } from '../lib/photos';

interface Props {
  ids: string[];
  onChange: (ids: string[]) => void;
  /** True when another task copy (an earlier or later day) still uses the photo. */
  isShared: (id: string) => boolean;
}

function useObjectUrl(id: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    let made: string | undefined;
    getPhoto(id)
      .then((blob) => {
        if (live && blob) {
          made = URL.createObjectURL(blob);
          setUrl(made);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return url;
}

function Thumb({ id, onOpen }: { id: string; onOpen: () => void }) {
  const url = useObjectUrl(id);
  return (
    <button type="button" className="thumb" onClick={onOpen} aria-label="View photo">
      {url ? <img src={url} alt="Photo of notes" /> : <span className="muted small">…</span>}
    </button>
  );
}

function Viewer({ id, onClose, onDelete }: { id: string; onClose: () => void; onDelete: () => void }) {
  const url = useObjectUrl(id);
  const ref = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="sheet viewer" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="sheet-body">
        {url && <img src={url} alt="Photo of notes" className="viewer-img" />}
        <footer className="sheet-foot">
          {confirm ? (
            <>
              <span className="small">Remove this photo?</span>
              <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>
                Keep
              </button>
              <button type="button" className="btn danger" onClick={onDelete}>
                Remove
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn ghost danger-text" onClick={() => setConfirm(true)}>
                Remove
              </button>
              <button type="button" className="btn primary" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}

/** Photos of handwritten notes on a task: take one, pick one, view, remove. */
export function PhotoStrip({ ids, onChange, isShared }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) added.push(await savePhoto(f));
      onChange([...ids, ...added]);
    } catch {
      setError('That photo could not be saved. Try again, or pick a smaller picture.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    onChange(ids.filter((x) => x !== id));
    setViewing(null);
    if (!isShared(id)) await deletePhoto(id).catch(() => undefined);
  };

  return (
    <div className="field photos">
      <span>Photos of notes</span>
      <div className="photo-row">
        {ids.map((id) => (
          <Thumb key={id} id={id} onOpen={() => setViewing(id)} />
        ))}
        <label className="photo-add" aria-busy={busy}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span>{busy ? 'Saving…' : 'Take photo'}</span>
          <input
            id="photo-camera"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <label className="photo-add">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 16l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span>Choose</span>
          <input
            id="photo-pick"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {error && <p className="small danger-text" role="alert">{error}</p>}
      {viewing && <Viewer id={viewing} onClose={() => setViewing(null)} onDelete={() => remove(viewing)} />}
    </div>
  );
}
