import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Allocations() {
  const { token, user } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    assetId: '',
    assignedTo: '',
    returnBy: '',
    notes: '',
  });

  async function load() {
    const [a, assetsRes] = await Promise.all([
      apiRequest('/api/allocations', { token }),
      apiRequest('/api/assets', { token }),
    ]);
    setAllocations(a.allocations);
    setAssets(assetsRes.assets.filter((x) => x.status !== 'retired' && x.status !== 'missing'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/allocations', {
        method: 'POST',
        token,
        body: {
          assetId: Number(form.assetId),
          assignedTo: form.assignedTo,
          allocatedBy: user?.displayName || user?.email,
          returnBy: form.returnBy || null,
          notes: form.notes || null,
        },
      });
      setForm({ assetId: '', assignedTo: '', returnBy: '', notes: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReturn(id) {
    setError('');
    try {
      await apiRequest(`/api/allocations/${id}/return`, { method: 'POST', token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Allocations</h1>
          <p className="muted">Assign assets to people and mark them returned</p>
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
                  <th>Assigned to</th>
                  <th>Return by</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allocations.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{row.assetCode}</strong>
                        <span className="muted">{row.assetName}</span>
                      </div>
                    </td>
                    <td>{row.assignedTo}</td>
                    <td>{row.returnBy || '—'}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      {row.status === 'allocated' ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleReturn(row.id)}
                        >
                          Mark returned
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel form-panel">
          <h2>Allocate asset</h2>
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
              Assigned to
              <input
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                required
              />
            </label>
            <label>
              Return by
              <input
                type="date"
                value={form.returnBy}
                onChange={(e) => setForm({ ...form, returnBy: e.target.value })}
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
              Allocate
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
