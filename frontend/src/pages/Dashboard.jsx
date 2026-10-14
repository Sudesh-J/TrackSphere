import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    apiRequest('/api/dashboard/summary', { token })
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading dashboard…</p>;

  const cards = [
    { label: 'Total assets', value: data.totals.total },
    { label: 'Available', value: data.totals.available },
    { label: 'Missing', value: data.totals.missing },
    { label: 'Maintenance', value: data.totals.maintenance },
    { label: 'In use', value: data.totals.inUse },
    { label: 'Retired', value: data.totals.retired },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Inventory overview and recent tracking activity</p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-secondary" to="/approvals">
            Pending approvals ({data.lifecycle.pendingApprovals})
          </Link>
          <Link className="btn btn-primary" to="/rfid">
            Simulate RFID scan
          </Link>
        </div>
      </header>

      <section className="card-grid">
        {cards.map((c) => (
          <article key={c.label} className="stat-card">
            <p className="stat-label">{c.label}</p>
            <p className="stat-value">{c.value}</p>
          </article>
        ))}
      </section>

      <section className="split">
        <article className="panel">
          <h2>Category summary</h2>
          <ul className="simple-list">
            {data.categories.map((c) => (
              <li key={c.category}>
                <span>{c.category}</span>
                <strong>{c.count}</strong>
              </li>
            ))}
          </ul>
          <p className="muted small">
            Active allocations: {data.lifecycle.activeAllocations}
          </p>
        </article>

        <article className="panel">
          <h2>Recent tracking events</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Scanned</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{e.assetCode}</strong>
                        <span className="muted">{e.assetName}</span>
                      </div>
                    </td>
                    <td>{e.location}</td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
                    <td>{new Date(e.scannedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
