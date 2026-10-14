import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Retirements() {
  const { token, user } = useAuth();
  const [retirements, setRetirements] = useState([]);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    assetId: '',
    retirementType: 'scrap',
    reason: '',
    notes: '',
  });

  async function load() {
    const [r, assetsRes] = await Promise.all([
      apiRequest('/api/retirements', { token }),
      apiRequest('/api/assets', { token }),
    ]);
    setRetirements(r.retirements);
    setAssets(assetsRes.assets.filter((a) => a.status !== 'retired'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/retirements', {
        method: 'POST',
        token,
        body: {
          assetId: Number(form.assetId),
          retirementType: form.retirementType,
          reason: form.reason,
          requestedBy: user?.displayName || user?.email,
          notes: form.notes || null,
        },
      });
      setForm({ assetId: '', retirementType: 'scrap', reason: '', notes: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Retirements</h1>
          <p className="muted">Request end-of-life for assets — approve under Approvals</p>
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
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {retirements.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{r.assetCode}</strong>
                        <span className="muted">{r.assetName}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={r.retirementType} />
                    </td>
                    <td>{r.reason}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel form-panel">
          <h2>Request retirement</h2>
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
                    {a.assetCode} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select
                value={form.retirementType}
                onChange={(e) => setForm({ ...form, retirementType: e.target.value })}
              >
                <option value="scrap">Scrap</option>
                <option value="sale">Sale</option>
                <option value="donate">Donate</option>
              </select>
            </label>
            <label>
              Reason
              <textarea
                rows={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                required
              />
            </label>
            <label>
              Notes
              <textarea
                rows={2}
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
