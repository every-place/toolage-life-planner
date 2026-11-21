import { useEffect, useState } from 'react';
import { monthOf, today } from './lib/dates';
import { updateSettings } from './lib/model';
import { usePlanner } from './lib/store';
import { DayPage } from './components/DayPage';
import { MonthPage } from './components/MonthPage';
import { GoalsPage } from './components/GoalsPage';
import { SettingsDialog } from './components/SettingsDialog';
import { onOpenSettings } from './lib/ui';

type View = { name: 'day'; date: string } | { name: 'month'; month: string } | { name: 'goals' };

function viewFromHash(): View {
  const h = window.location.hash.slice(1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(h)) return { name: 'day', date: h };
  if (h === 'month') return { name: 'month', month: monthOf(today()) };
  const m = /^month-(\d{4}-\d{2})$/.exec(h);
  if (m) return { name: 'month', month: m[1] };
  if (h === 'goals') return { name: 'goals' };
  return { name: 'day', date: today() };
}

function hashFor(v: View): string {
  if (v.name === 'day') return v.date === today() ? '' : `#${v.date}`;
  if (v.name === 'month') return v.month === monthOf(today()) ? '#month' : `#month-${v.month}`;
  return '#goals';
}

export default function App() {
  const { state, apply, replace } = usePlanner();
  const [view, setView] = useState<View>(viewFromHash);
  const [lastDay, setLastDay] = useState(view.name === 'day' ? view.date : today());
  const [focusGoal, setFocusGoal] = useState<string | undefined>();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => onOpenSettings(() => setShowSettings(true)), []);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const want = hashFor(view);
    if (window.location.hash !== want) history.replaceState(null, '', want || window.location.pathname);
    if (view.name === 'day') setLastDay(view.date);
    window.scrollTo(0, 0);
  }, [view]);

  const goDay = (date: string) => setView({ name: 'day', date });
  const goGoal = (id: string) => {
    setFocusGoal(id);
    setView({ name: 'goals' });
  };

  const tabs: { key: View['name']; label: string; go: () => void; icon: JSX.Element }[] = [
    {
      key: 'day',
      label: 'Day',
      go: () => goDay(lastDay),
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      ),
    },
    {
      key: 'month',
      label: 'Month',
      go: () => setView({ name: 'month', month: monthOf(lastDay) }),
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      ),
    },
    {
      key: 'goals',
      label: 'Goals',
      go: () => {
        setFocusGoal(undefined);
        setView({ name: 'goals' });
      },
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      ),
    },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="36" height="36" />
          <span className="wordmark">
            <b>Life</b>
            <i>Planner</i>
          </span>
          <span className="by">
            by <b>Toolage</b>
          </span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {tabs.map((t) => (
            <button key={t.key} className={`tab${view.name === t.key ? ' on' : ''}`} onClick={t.go} aria-current={view.name === t.key ? 'page' : undefined}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.1.1-1.4-.1-1.4 2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4L14.2 2.6h-4l-.4 2.6a7 7 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.6-.1 1.4.1 1.4-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.4 2.6h4l.4-2.6a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <main className="page">
        {view.name === 'day' && (
          <DayPage state={state} apply={apply} date={view.date} setDate={goDay} onOpenGoal={goGoal} />
        )}
        {view.name === 'month' && (
          <MonthPage
            state={state}
            apply={apply}
            month={view.month}
            setMonth={(m) => setView({ name: 'month', month: m })}
            onOpenDay={goDay}
          />
        )}
        {view.name === 'goals' && <GoalsPage state={state} apply={apply} focusGoalId={focusGoal} onGoTo={goDay} />}
      </main>

      {showSettings && (
        <SettingsDialog
          state={state}
          onSave={(s) => apply((st) => updateSettings(st, s))}
          onImport={(s) => replace(s)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
