const OPEN_SETTINGS = 'lifeplanner:open-settings';

/** Asks the app shell to open Settings, scrolled to the margin letters. */
export function openSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS));
}

export function onOpenSettings(fn: () => void): () => void {
  window.addEventListener(OPEN_SETTINGS, fn);
  return () => window.removeEventListener(OPEN_SETTINGS, fn);
}
