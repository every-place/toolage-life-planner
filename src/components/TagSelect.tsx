import type { MarginTag } from '../lib/model';
import { openSettings } from '../lib/ui';

interface Props {
  id: string;
  value: string;
  onChange: (letter: string) => void;
  tags: MarginTag[];
  /** Text for the "no tag" choice. */
  emptyLabel?: string;
  className?: string;
}

const EDIT = '__edit';

/** Margin-letter dropdown with a shortcut to edit the list of letters. */
export function TagSelect({ id, value, onChange, tags, emptyLabel = 'None', className }: Props) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      aria-label="Margin letter"
      onChange={(e) => {
        if (e.target.value === EDIT) openSettings();
        else onChange(e.target.value);
      }}
    >
      <option value="">{emptyLabel}</option>
      {tags.map((t) => (
        <option key={t.letter} value={t.letter}>
          {t.letter} · {t.label}
        </option>
      ))}
      {value && !tags.some((t) => t.letter === value) && <option value={value}>{value}</option>}
      <option value={EDIT}>Edit letters…</option>
    </select>
  );
}
