import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, QrCode } from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/PageHeader';
import LoadingBlock from '../components/LoadingBlock';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';

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

  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return <LoadingBlock label="Loading dashboard…" />;

  const cards = [
    { label: 'Total assets', value: data.totals.total },
    { label: 'Available', value: data.totals.available },
    { label: 'In use', value: data.totals.inUse },
    { label: 'Maintenance', value: data.totals.maintenance },
    { label: 'Missing', value: data.totals.missing },
    { label: 'Retired', value: data.totals.retired },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="Inventory overview, lifecycle pressure, and recent tracking activity."
        actions={
          <>
            <Link className="btn btn-secondary" to="/approvals">
              <ClipboardCheck size={16} aria-hidden="true" />
              Approvals ({data.lifecycle.pendingApprovals})
            </Link>
            <Link className="btn btn-primary" to="/scan">
              <QrCode size={16} aria-hidden="true" />
              Scan / handover
            </Link>
          </>
        }
      />

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
          <div className="panel-header">
            <h2>Category mix</h2>
            <span className="muted small">
              Active allocations: {data.lifecycle.activeAllocations}
            </span>
          </div>
          {data.categories?.length ? (
            <ul className="simple-list">
              {data.categories.map((c) => (
                <li key={c.category}>
                  <span>{c.category}</span>
                  <strong>{c.count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No categories yet" />
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Recent tracking</h2>
          </div>
          <div className="table-wrap">
            {data.recentEvents?.length ? (
              <table className="table-responsive">
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
                      <td data-label="Asset">
                        <div className="cell-stack">
                          <strong>{e.assetCode}</strong>
                          <span className="muted">{e.assetName}</span>
                        </div>
                      </td>
                      <td data-label="Location">{e.location}</td>
                      <td data-label="Status">
                        <StatusBadge status={e.status} />
                      </td>
                      <td data-label="Scanned">{new Date(e.scannedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="No recent scans" description="Tracking events will appear here." />
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
