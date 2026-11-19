import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import LoadingBlock from '../components/LoadingBlock';

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
      <PageHeader
        title="Gemini assistant"
        description="Find assets, summarize inventory, explain the app. Data changes require confirmation."
      />

      {status ? (
        <Alert type={status.geminiConfigured ? 'success' : 'error'}>{status.message}</Alert>
      ) : null}
      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <section className="assistant-thread panel">
        {message || reply ? (
          <>
            <div className="chat-bubble user">
              <p className="muted small">You</p>
              <p>{message}</p>
            </div>
            {loading ? <LoadingBlock label="Thinking…" /> : null}
            {reply ? (
              <div className="chat-bubble assistant">
                <p className="muted small">Assistant</p>
                <pre className="assistant-reply">{reply}</pre>
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">Ask a question below to start the thread.</p>
        )}
      </section>

      <form className="stack-form panel" onSubmit={send}>
        <label>
          Ask TrackSphere
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          <Send size={16} aria-hidden="true" />
          {loading ? 'Thinking…' : 'Send'}
        </button>
      </form>

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
        <article className="panel confirm-card">
          <h2>Draft action (not saved yet)</h2>
          <pre className="assistant-reply">{JSON.stringify(draft, null, 2)}</pre>
          <button type="button" className="btn btn-primary" onClick={confirmDraft}>
            Confirm &amp; save
          </button>
        </article>
      ) : null}
    </div>
  );
}