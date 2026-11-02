import { useEffect, useState } from 'react';
import ReviewReceipt from './pages/ReviewReceipt';
import BalanceView from './pages/BalanceView';
import SetupView from './pages/SetupView';
import ShoppingList from './pages/ShoppingList';
import Analytics from './pages/Analytics';
import Chores from './pages/Chores';
import { initTelegram, isTelegram } from './lib/telegram';

interface Route {
  receiptId: number | null;
  view: string | null;
}

function readRoute(): Route {
  const q = new URLSearchParams(window.location.search);
  const rid = q.get('receiptId');
  return { receiptId: rid ? Number(rid) : null, view: q.get('view') };
}

const TABS = [
  { key: null, label: 'Home', icon: '🏠' },
  { key: 'balance', label: 'Balance', icon: '💰' },
  { key: 'shopping', label: 'List', icon: '🛒' },
  { key: 'chores', label: 'Chores', icon: '🧹' },
  { key: 'analytics', label: 'Stats', icon: '📊' },
] as const;

export default function App() {
  const [route, setRoute] = useState<Route>(() => readRoute());

  useEffect(() => {
    initTelegram();
  }, []);

  const navigate = (to: Partial<Route>) => {
    const q = new URLSearchParams();
    if (to.receiptId) q.set('receiptId', String(to.receiptId));
    if (to.view) q.set('view', to.view);
    const qs = q.toString();
    window.history.pushState({}, '', qs ? `?${qs}` : window.location.pathname);
    setRoute(readRoute());
  };

  const goHome = () => navigate({});
  const go = (view: string) => navigate({ view });
  const goReceipt = (id: number) => navigate({ receiptId: id });

  if (!isTelegram()) {
    return (
      <div className="center">
        <div className="card">
          <h1 className="brand">FlatOps</h1>
          <p className="muted">Please open FlatOps from inside Telegram.</p>
        </div>
      </div>
    );
  }

  const showTabs =
    !route.receiptId &&
    (!route.view ||
      route.view === 'balance' ||
      route.view === 'shopping' ||
      route.view === 'chores' ||
      route.view === 'analytics');

  let content;
  if (route.receiptId) {
    content = <ReviewReceipt receiptId={route.receiptId} onHome={goHome} />;
  } else if (route.view === 'balance') {
    content = <BalanceView onBack={goHome} onOpenReceipt={goReceipt} />;
  } else if (route.view === 'shopping') {
    content = <ShoppingList onBack={goHome} />;
  } else if (route.view === 'chores') {
    content = <Chores onBack={goHome} />;
  } else if (route.view === 'analytics') {
    content = <Analytics onBack={goHome} />;
  } else if (route.view === 'setup') {
    content = <SetupView onDone={goHome} />;
  } else {
    content = <HomeScreen onNavigate={go} onSetup={() => go('setup')} />;
  }

  return (
    <div className="app">
      {content}
      {showTabs && (
        <nav className="tab-bar">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`tab ${route.view === t.key ? 'tab--active' : ''}`}
              onClick={() => (t.key === null ? goHome() : go(t.key))}
            >
              <span className="tab__icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function HomeScreen({ onNavigate, onSetup }: {
  onNavigate: (view: string) => void;
  onSetup: () => void;
}) {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="brand">FlatOps</h1>
      </header>
      <p className="muted">Shared living, simplified.</p>

      <div className="home-grid">
        <button className="tile" onClick={() => onNavigate('balance')}>
          <span className="tile__icon">💰</span>
          <span className="tile__label">Balance</span>
          <span className="tile__desc">Who owes whom</span>
        </button>
        <button className="tile" onClick={() => onNavigate('shopping')}>
          <span className="tile__icon">🛒</span>
          <span className="tile__label">Shopping list</span>
          <span className="tile__desc">Shared checklist</span>
        </button>
        <button className="tile" onClick={() => onNavigate('chores')}>
          <span className="tile__icon">🧹</span>
          <span className="tile__label">Chores</span>
          <span className="tile__desc">Rotating routines</span>
        </button>
        <button className="tile" onClick={() => onNavigate('analytics')}>
          <span className="tile__icon">📊</span>
          <span className="tile__label">Analytics</span>
          <span className="tile__desc">Monthly spend</span>
        </button>
        <button className="tile tile--ghost" onClick={onSetup}>
          <span className="tile__icon">🔐</span>
          <span className="tile__label">Setup</span>
          <span className="tile__desc">First-time config</span>
        </button>
      </div>

      <p className="muted small center home-hint">
        Send a receipt photo to the bot in Telegram — its &ldquo;Review
        receipt&rdquo; button opens the editor here.
      </p>
    </div>
  );
}
