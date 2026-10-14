import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Transfers() {
  const { token, user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ assetId: '', toLocation: '', notes: '' });

  async function load() {
    const [t, assetsRes] = await Promise.all([
      apiRequest('/api/transfers', { token }),
      apiRequest('/api/assets', { token }),
    ]);
    setTransfers(t.transfers);
    setAssets(assetsRes.assets.filter((a) => a.status !== 'retired'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/transfers', {
        method: 'POST',
        token,
        body: {
          assetId: Number(form.assetId),
          toLocation: form.toLocation,
          requestedBy: user?.displayName || user?.email,
          notes: form.notes || null,
        },
      });
      setForm({ assetId: '', toLocation: '', notes: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Transfers</h1>
          <p className="muted">Request location moves — approve them under Approvals</p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <section className="split">
        <article className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>From → To</th>
                  <th>Requested by</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{t.assetCode}</strong>
                        <span className="muted">{t.assetName}</span>
                      </div>
                    </td>
                    <td>
                      {t.fromLocation} → {t.toLocation}
                    </td>
                    <td>{t.requestedBy}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel form-panel">
          <h2>Request transfer</h2>
          <form className="stack-form" onSubmit={handleCreate}>
            <label>
              Asset
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                required
              >
                <option value="">Select asset</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetCode} — {a.name} ({a.location})
                  </option>
                ))}
              </select>
            </label>
            <label>
              To location
              <input
                value={form.toLocation}
                onChange={(e) => setForm({ ...form, toLocation: e.target.value })}
                required
              />
            </label>
            <label>
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <button className="btn btn-primary" type="submit">
              Submit request
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
