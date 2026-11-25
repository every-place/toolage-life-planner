// Keeps the planner in the browser's local storage, and in the cloud when
// signed in (see cloud.ts), so phone and computer share the same planner.
// The rest of the app only talks to usePlanner().

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, emptyState, type PlannerState } from './model';
import { useCloudSync } from './cloud';

const KEY = 'lifeplanner.v1';

export function loadState(): PlannerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return normalize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function normalize(data: unknown): PlannerState {
  const base = emptyState();
  if (!data || typeof data !== 'object') return base;
  const d = data as Partial<PlannerState>;
  return {
    version: 1,
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    daily: d.daily && typeof d.daily === 'object' ? d.daily : {},
    goals: Array.isArray(d.goals) ? d.goals : [],
    events: Array.isArray(d.events) ? d.events : [],
    inbox: Array.isArray(d.inbox) ? d.inbox : [],
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
  };
}

function saveState(state: PlannerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; the app keeps working for this session.
  }
}

export function usePlanner() {
  const [state, setState] = useState<PlannerState>(loadState);

  useEffect(() => saveState(state), [state]);

  // Pick up changes made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(loadState());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const apply = useCallback((fn: (s: PlannerState) => PlannerState) => setState(fn), []);
  const cloud = useCloudSync(state, apply);
  return { state, apply, replace: setState, cloud };
}
