// Dates are stored as local calendar days in "YYYY-MM-DD" form.

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toDayKey(new Date());
}

export function addDays(key: string, n: number): string {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

export function formatLong(key: string): string {
  return fromDayKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShort(key: string): string {
  return fromDayKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Day of the year, 1-366, like the number printed on a paper daily page. */
export function dayOfYear(key: string): number {
  const d = fromDayKey(key);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.round((d.getTime() - start.getTime()) / 86400000) + 1;
}

export function daysLeftInYear(key: string): number {
  const d = fromDayKey(key);
  const end = new Date(d.getFullYear(), 11, 31);
  return Math.round((end.getTime() - d.getTime()) / 86400000);
}
