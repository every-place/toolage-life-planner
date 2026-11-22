import { useObjectUrl } from '../lib/usePhotoUrl';

/** Tiny preview of a task's first note photo, shown in the task list. */
export function RowThumb({ ids, onOpen }: { ids: string[]; onOpen: () => void }) {
  const url = useObjectUrl(ids[0]);
  return (
    <button
      type="button"
      className="row-thumb"
      onClick={onOpen}
      aria-label={`${ids.length} photo${ids.length === 1 ? '' : 's'} of notes. Open task.`}
      title={`${ids.length} photo${ids.length === 1 ? '' : 's'} of notes`}
    >
      {url ? <img src={url} alt="" /> : <span aria-hidden="true">📷</span>}
      {ids.length > 1 && <span className="row-thumb-count">{ids.length}</span>}
    </button>
  );
}
