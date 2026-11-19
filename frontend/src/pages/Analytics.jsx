import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import LoadingBlock from '../components/LoadingBlock';
import EmptyState from '../components/EmptyState';

export default function Analytics() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest('/api/analytics/overview?staleDays=7', { token })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="page">
      <PageHeader title="Analytics" description={data?.note || 'Operational inventory signals.'} />

      <Alert type="error">{error}</Alert>
      {loading ? <LoadingBlock label="Loading analytics…" /> : null}

      {data ? (
        <>
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
              {data.staleAssets.length === 0 ? (
                <EmptyState title="No stale assets" description="All tracked assets were scanned recently." />
              ) : (
                <table className="table-responsive">
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
                        <td data-label="Asset">
                          {a.assetCode} — {a.name}
                        </td>
                        <td data-label="Location">{a.location}</td>
                        <td data-label="Status">
                          <StatusBadge status={a.status} />
                        </td>
                        <td data-label="Last scanned">
                          {a.lastScannedAt
                            ? new Date(a.lastScannedAt).toLocaleString()
                            : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </article>
        </>
      ) : null}
    </div>
  );
}