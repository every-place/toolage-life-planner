interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  /** What the item is, for screen readers, e.g. "Call bank". */
  label: string;
}

/** Small check that marks an item as written in the paper planner. */
export function PaperToggle({ on, onChange, label }: Props) {
  return (
    <button
      type="button"
      className={`paper${on ? ' on' : ''}`}
      aria-pressed={on}
      aria-label={`${label}: ${on ? 'on paper' : 'not on paper yet'}`}
      title={on ? 'On paper' : 'Not on paper yet'}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        {on && <path d="M13 7l4 4" stroke="currentColor" strokeWidth="1.8" />}
      </svg>
    </button>
  );
}
