import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Agents() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/agents', { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading agents…</p>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Edge agents</h1>
          <p className="muted">Seeded demo data — not real IoT hardware</p>
        </div>
      </header>

      <section className="card-grid">
        {data.agents.map((agent) => (
          <article key={agent.id} className="stat-card">
            <p className="stat-label">{agent.agentCode}</p>
            <p className="stat-value-sm">{agent.displayName}</p>
            <p className="muted">{agent.location}</p>
            <p>
              <StatusBadge status={agent.status} />
            </p>
            <p className="muted small">
              Last heartbeat:{' '}
              {agent.lastHeartbeat
                ? new Date(agent.lastHeartbeat).toLocaleString()
                : '—'}
            </p>
          </article>
        ))}
      </section>

      <article className="panel">
        <h2>Recent scan events</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>RFID</th>
                <th>Location</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recentScanEvents.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.assetCode} — {e.assetName}
                  </td>
                  <td>
                    <code>{e.rfidTagId}</code>
                  </td>
                  <td>{e.location}</td>
                  <td>{new Date(e.scannedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
