import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import Alert from './Alert';
import LoadingBlock from './LoadingBlock';

export default function AssistantPanel({ compact = false }) {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(compact ? '' : 'Summarize our inventory');
  const [turns, setTurns] = useState([]);
  const [assets, setAssets] = useState([]);
  const [draft, setDraft] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const threadRef = useRef(null);

  useEffect(() => {
    apiRequest('/api/assistant/status', { token })
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, loading, draft, assets]);

  async function send(e) {
    e.preventDefault();
    const text = message.trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setMessage('');
    setTurns((prev) => [...prev, { role: 'user', text }]);
    try {
      const data = await apiRequest('/api/assistant/chat', {
        method: 'POST',
        token,
        body: { message: text },
      });
      setTurns((prev) => [...prev, { role: 'assistant', text: data.reply || '' }]);
      setAssets(data.assets || []);
      setDraft(data.draft || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function confirmDraft() {
    if (!draft || confirming) return;
    setConfirming(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiRequest('/api/assistant/confirm', {
        method: 'POST',
        token,
        body: { confirmed: true, draft },
      });
      setSuccess(`Created ${data.assetCode}`);
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', text: `Saved ${data.assetCode}. It is now in the asset register.` },
      ]);
      setDraft(null);
    } catch (err) {
      setError(err.message || 'Could not save the asset');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className={`assistant-panel ${compact ? 'is-compact' : ''}`}>
      {status ? (
        <Alert type={status.geminiConfigured ? 'success' : 'warn'}>{status.message}</Alert>
      ) : null}
      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="assistant-scroll" ref={threadRef}>
        <section className="assistant-thread" aria-live="polite">
          {turns.length === 0 && !loading ? (
            <p className="muted small assistant-empty">
              Ask about assets, inventory, or how TrackSphere works. Changes are saved only after you confirm.
            </p>
          ) : null}
          {turns.map((turn, i) => (
            <div key={`${turn.role}-${i}`} className={`chat-bubble ${turn.role === 'user' ? 'user' : 'assistant'}`}>
              <p className="muted small">{turn.role === 'user' ? 'You' : 'Assistant'}</p>
              {turn.role === 'user' ? <p>{turn.text}</p> : <pre className="assistant-reply">{turn.text}</pre>}
            </div>
          ))}
          {loading ? <LoadingBlock label="Thinking…" /> : null}
        </section>

        {assets.length ? (
          <div className="assistant-matches">
            <p className="muted small">Matched assets</p>
            <ul className="simple-list">
              {assets.map((a) => (
                <li key={a.assetCode || a.name}>
                  <span>
                    {a.assetCode} — {a.name}
                  </span>
                  <strong>{a.status}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {draft ? (
          <div className="confirm-card">
            <p className="muted small">Draft — not saved until you confirm</p>
            <label>
              Asset code
              <input value={draft.assetCode || ''} onChange={(e) => updateDraft('assetCode', e.target.value)} />
            </label>
            <label>
              Name
              <input value={draft.name || ''} onChange={(e) => updateDraft('name', e.target.value)} />
            </label>
            <label>
              Category
              <input value={draft.category || ''} onChange={(e) => updateDraft('category', e.target.value)} />
            </label>
            <label>
              Location
              <input value={draft.location || ''} onChange={(e) => updateDraft('location', e.target.value)} />
            </label>
            <label>
              Price
              <input
                type="number"
                value={draft.purchaseCost ?? ''}
                onChange={(e) => updateDraft('purchaseCost', e.target.value)}
              />
            </label>
            <label>
              Serial number
              <input
                value={draft.serialNumber || ''}
                onChange={(e) => updateDraft('serialNumber', e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-primary" onClick={confirmDraft} disabled={confirming}>
              {confirming ? 'Saving…' : 'Confirm & save'}
            </button>
          </div>
        ) : null}
      </div>

      <form className="assistant-composer" onSubmit={send}>
        <label className="sr-only" htmlFor={compact ? 'assistant-dock-input' : 'assistant-page-input'}>
          Ask TrackSphere
        </label>
        <textarea
          id={compact ? 'assistant-dock-input' : 'assistant-page-input'}
          rows={compact ? 2 : 3}
          placeholder="Ask TrackSphere…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !message.trim()} aria-label="Send">
          <Send size={16} aria-hidden="true" />
          {compact ? null : loading ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
