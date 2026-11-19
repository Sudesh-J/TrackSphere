import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import LoadingBlock from '../components/LoadingBlock';
import EmptyState from '../components/EmptyState';

export default function DeviceHealth() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const d = await apiRequest('/api/device-health/devices', { token });
      setData(d);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function insertDemo() {
    try {
      await apiRequest('/api/device-health/demo-checkin', { method: 'POST', token });
      setSuccess('Inserted DEMO check-in (labeled as demo data)');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Device health"
        description="Windows laptop health agent check-ins. Warnings are threshold/trend based — not predictive maintenance."
        actions={
          <button type="button" className="btn btn-secondary" onClick={insertDemo}>
            Insert demo telemetry
          </button>
        }
      />

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>
      {loading ? <LoadingBlock label="Loading device health…" /> : null}

      {data ? (
        <>
          <p className="hint">{data.note}</p>
          <section className="card-grid">
            {data.devices.length === 0 ? (
              <EmptyState
                title="No check-ins yet"
                description="Run the agent or insert demo telemetry."
              />
            ) : null}
            {data.devices.map((d) => (
              <article key={d.deviceId} className="stat-card">
                <p className="stat-label">
                  {d.deviceId}
                  {d.isDemo ? <span className="badge badge-demo">Demo data</span> : null}
                </p>
                <p>CPU: {d.cpuPercent ?? '—'}%</p>
                <p>Memory: {d.memoryPercent ?? '—'}%</p>
                <p>Battery: {d.batteryPercent ?? '—'}%</p>
                <p>Battery health: {d.batteryHealth || 'Unavailable'}</p>
                <p className="muted small">{new Date(d.checkedAt).toLocaleString()}</p>
              </article>
            ))}
          </section>

          <article className="panel">
            <h2>Health warnings</h2>
            {data.warnings.length === 0 ? (
              <EmptyState title="No warnings" />
            ) : (
              <ul className="warning-list">
                {data.warnings.map((w, i) => (
                  <li key={i} className="warning-item">
                    <span>
                      {w.deviceId}: {w.message}
                      {w.isDemo ? <span className="badge badge-demo">Demo</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </>
      ) : null}
    </div>
  );
}