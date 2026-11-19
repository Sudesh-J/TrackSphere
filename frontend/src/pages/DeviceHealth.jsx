import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';

export default function DeviceHealth() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    try {
      const d = await apiRequest('/api/device-health/devices', { token });
      setData(d);
      setError('');
    } catch (err) {
      setError(err.message);
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
      <header className="page-header">
        <div>
          <h1>Device health</h1>
          <p className="muted">
            Windows laptop health agent check-ins. Warnings are threshold/trend based — not
            predictive maintenance.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={insertDemo}>
          Insert demo telemetry
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}
      {!data ? <p className="muted">Loading…</p> : null}

      {data ? (
        <>
          <p className="hint">{data.note}</p>
          <section className="card-grid">
            {data.devices.length === 0 ? (
              <p className="muted">No check-ins yet. Run the agent or insert demo telemetry.</p>
            ) : null}
            {data.devices.map((d) => (
              <article key={d.deviceId} className="stat-card">
                <p className="stat-label">
                  {d.deviceId} {d.isDemo ? '(DEMO)' : ''}
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
              <p className="muted">No warnings.</p>
            ) : (
              <ul className="simple-list">
                {data.warnings.map((w, i) => (
                  <li key={i}>
                    <span>
                      {w.deviceId}: {w.message}
                      {w.isDemo ? ' [DEMO]' : ''}
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
