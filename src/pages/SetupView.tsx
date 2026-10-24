import { useState } from 'react';
import { adminBootstrap } from '../lib/api';

interface Props {
  onDone: () => void;
}

export default function SetupView({ onDone }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminBootstrap(code);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="center">
        <div className="card card--success">
          <div className="success-icon">🔐</div>
          <h2>Setup code saved</h2>
          <p className="muted">
            Now share this code with your roommate, then both of you send
            <code> /register {code}</code> to the bot in Telegram.
          </p>
          <button className="btn btn--primary btn--block" onClick={onDone}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__header">
        <span />
        <h1 className="page__title">First-time setup</h1>
        <span />
      </header>

      <section className="card">
        <p className="muted">
          Choose a setup code (at least 6 characters). Only people who know this
          code can register as participants, so a stranger who finds the bot
          cannot claim it.
        </p>
        <label className="field">
          <span className="field__label">Setup code</span>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. our-flat-2026"
            autoCapitalize="none"
          />
        </label>
        {error && <div className="banner banner--error">{error}</div>}
        <button className="btn btn--primary btn--block" disabled={busy || code.trim().length < 6} onClick={submit}>
          {busy ? 'Saving…' : 'Save setup code'}
        </button>
      </section>
    </div>
  );
}
