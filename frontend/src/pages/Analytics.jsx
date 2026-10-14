import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Analytics() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/analytics/overview?staleDays=7', { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading analytics…</p>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="muted">{data.note}</p>
        </div>
      </header>

      <section className="card-grid">
        <article className="stat-card">
          <p className="stat-label">Missing assets</p>
          <p className="stat-value">{data.missingCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Stale (not scanned {data.rules.staleNotScannedDays}+ days)</p>
          <p className="stat-value">{data.staleAssets.length}</p>
        </article>
      </section>

      <section className="split">
        <article className="panel">
          <h2>By status</h2>
          <ul className="simple-list">
            {data.byStatus.map((row) => (
              <li key={row.status}>
                <StatusBadge status={row.status} />
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h2>By category</h2>
          <ul className="simple-list">
            {data.byCategory.map((row) => (
              <li key={row.category}>
                <span>{row.category}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <article className="panel">
        <h2>Stale assets</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Location</th>
                <th>Status</th>
                <th>Last scanned</th>
              </tr>
            </thead>
            <tbody>
              {data.staleAssets.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.assetCode} — {a.name}
                  </td>
                  <td>{a.location}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>
                    {a.lastScannedAt
                      ? new Date(a.lastScannedAt).toLocaleString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
