import { useEffect, useState } from 'react';
import ReviewReceipt from './pages/ReviewReceipt';
import BalanceView from './pages/BalanceView';
import SetupView from './pages/SetupView';
import ShoppingList from './pages/ShoppingList';
import Analytics from './pages/Analytics';
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
  const goBalance = () => navigate({ view: 'balance' });
  const goSetup = () => navigate({ view: 'setup' });
  const goShopping = () => navigate({ view: 'shopping' });
  const goAnalytics = () => navigate({ view: 'analytics' });
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

  if (route.receiptId) return <ReviewReceipt receiptId={route.receiptId} onHome={goHome} />;
  if (route.view === 'balance') return <BalanceView onBack={goHome} onOpenReceipt={goReceipt} />;
  if (route.view === 'shopping') return <ShoppingList onBack={goHome} />;
  if (route.view === 'analytics') return <Analytics onBack={goHome} />;
  if (route.view === 'setup') return <SetupView onDone={goHome} />;

  return (
    <div className="page">
      <header className="page__header">
        <span />
        <h1 className="brand">FlatOps</h1>
        <span />
      </header>
      <p className="muted center">Shared living, simplified.</p>
      <div className="stack">
        <button className="btn btn--primary btn--block" onClick={goBalance}>
          💰 View balance & history
        </button>
        <button className="btn btn--primary btn--block" onClick={goShopping}>
          🛒 Shopping list
        </button>
        <button className="btn btn--primary btn--block" onClick={goAnalytics}>
          📊 Spending analytics
        </button>
        <button className="btn btn--ghost btn--block" onClick={goSetup}>
          🔐 First-time setup
        </button>
        <p className="muted small center">
          Send a receipt photo to the bot in Telegram to start. The &ldquo;Review
          receipt&rdquo; button opens this app.
        </p>
      </div>
    </div>
  );
}
