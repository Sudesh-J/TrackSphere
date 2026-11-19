import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';

export default function Assistant() {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('Summarize our inventory');
  const [reply, setReply] = useState('');
  const [assets, setAssets] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiRequest('/api/assistant/status', { token })
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, [token]);

  async function send(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiRequest('/api/assistant/chat', {
        method: 'POST',
        token,
        body: { message },
      });
      setReply(data.reply);
      setAssets(data.assets || []);
      setDraft(data.draft || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDraft() {
    try {
      const data = await apiRequest('/api/assistant/confirm', {
        method: 'POST',
        token,
        body: { confirmed: true, draft },
      });
      setSuccess(`Created ${data.assetCode}`);
      setDraft(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Gemini assistant</h1>
          <p className="muted">
            Find assets, summarize inventory, explain the app. Data changes require confirmation.
          </p>
        </div>
      </header>

      {status ? (
        <p className={status.geminiConfigured ? 'ok' : 'error'}>{status.message}</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}

      <form className="stack-form panel" onSubmit={send}>
        <label>
          Ask TrackSphere
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Thinking…' : 'Send'}
        </button>
      </form>

      {reply ? (
        <article className="panel">
          <h2>Reply</h2>
          <pre className="assistant-reply">{reply}</pre>
        </article>
      ) : null}

      {assets.length ? (
        <article className="panel">
          <h2>Matched assets</h2>
          <ul className="simple-list">
            {assets.map((a) => (
              <li key={a.assetCode}>
                <span>
                  {a.assetCode} — {a.name}
                </span>
                <strong>{a.status}</strong>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {draft ? (
        <article className="panel">
          <h2>Draft action (not saved yet)</h2>
          <pre className="assistant-reply">{JSON.stringify(draft, null, 2)}</pre>
          <button type="button" className="btn btn-primary" onClick={confirmDraft}>
            Confirm & save
          </button>
        </article>
      ) : null}
    </div>
  );
}
