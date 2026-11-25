import { useState } from 'react';
import { formatShort } from '../lib/dates';
import { dismissInboxItem, inboxOrder, planInboxItem } from '../lib/inbox';
import { PRIORITIES, type PlannerState } from '../lib/model';
import { ImportDialog } from './ImportDialog';

interface Props {
  state: PlannerState;
  apply: (fn: (s: PlannerState) => PlannerState) => void;
  date: string;
}

/**
 * Tasks sent in from other systems, waiting for a letter. Tap A, B or C to put
 * one at the bottom of that letter on this day, then renumber as usual.
 */
export function InboxSection({ state, apply, date }: Props) {
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const items = inboxOrder(state);
  const { settings } = state;
  const tagLabel = (letter?: string) => settings.tags.find((t) => t.letter === letter)?.label ?? '';

  if (items.length === 0) return null;

  return (
    <section className="inbox card" aria-label="Task inbox">
      <div className="list-head">
        <h2>
          Inbox <span className="inbox-count">{items.length}</span>
        </h2>
        <span className="muted small">
          Give each a letter to put it on this day ·{' '}
          <button className="link small" onClick={() => setImporting(true)}>
            Import
          </button>
        </span>
      </div>
      <ul className="inbox-list">
        {items.map((it) => (
          <li key={it.id} className="inbox-row">
            <div className="inbox-main">
              <button className="inbox-title" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id}>
                {it.tag && (
                  <span className="c-tag" title={tagLabel(it.tag)}>
                    {it.tag}
                  </span>
                )}
                <span className="title-text">{it.title}</span>
              </button>
              <span className="inbox-meta">
                {it.source.name}
                {it.due && <> · due {formatShort(it.due)}</>}
                {it.suggested && <> · suggests {settings.prioritySymbols[it.suggested]}</>}
              </span>
              {open === it.id && (
                <div className="inbox-more small">
                  {it.notes && <p className="note">{it.notes}</p>}
                  {it.source.link && (
                    <a className="link" href={it.source.link} target="_blank" rel="noreferrer">
                      Open link
                    </a>
                  )}
                  <p className="muted">Received {new Date(it.source.receivedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="inbox-actions">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  className={`inbox-prio prio-${p}${it.suggested === p ? ' suggested' : ''}`}
                  onClick={() => apply((s) => planInboxItem(s, it.id, date, p))}
                  aria-label={`Put “${it.title}” on this day as ${p === 'A' ? 'Must' : p === 'B' ? 'Should' : 'Want'}`}
                  title={p === 'A' ? 'Must' : p === 'B' ? 'Should' : 'Want'}
                >
                  {settings.prioritySymbols[p]}
                </button>
              ))}
              <button className="mini" onClick={() => apply((s) => dismissInboxItem(s, it.id))} aria-label={`Dismiss “${it.title}”`} title="Dismiss">
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      {importing && <ImportDialog state={state} apply={apply} onClose={() => setImporting(false)} />}
    </section>
  );
}
