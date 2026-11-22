import type { Status } from '../lib/model';

const LABELS: Record<Status, string> = {
  open: 'Not started',
  inwork: 'In work',
  done: 'Complete',
  forwarded: 'Forwarded',
  cancelled: 'Cancelled',
};

export function statusLabel(s: Status) {
  return LABELS[s];
}

/** The mark in the status column: blank, dot, check or right arrow. */
export function StatusMark({ status }: { status: Status }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={`mark mark-${status}`}>
      {status === 'inwork' && <circle cx="12" cy="12" r="4.5" fill="currentColor" />}
      {status === 'done' && (
        <path d="M5 12.5 L10 17.5 L19 6.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {status === 'cancelled' && (
        <path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      )}
      {status === 'forwarded' && (
        <path d="M4 12 H19 M13 6 L19 12 L13 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
