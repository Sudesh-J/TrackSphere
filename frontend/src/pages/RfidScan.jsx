import { useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function RfidScan() {
  const { token } = useAuth();
  const [rfidTagId, setRfidTagId] = useState('RFID-TAG-1002');
  const [location, setLocation] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleScan(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await apiRequest('/api/tracking/scan', {
        method: 'POST',
        token,
        body: {
          rfidTagId: rfidTagId.trim(),
          location: location.trim() || undefined,
        },
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>RFID scan (simulation)</h1>
          <p className="muted">
            No real RFID hardware — this form calls the API with a tag ID
          </p>
        </div>
      </header>

      <section className="split">
        <article className="panel form-panel">
          <form className="stack-form" onSubmit={handleScan}>
            <label>
              RFID tag ID
              <input
                value={rfidTagId}
                onChange={(e) => setRfidTagId(e.target.value)}
                required
              />
            </label>
            <label>
              Location override (optional)
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Leave blank to keep current location"
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Scanning…' : 'Scan'}
            </button>
            <p className="hint">Try RFID-TAG-1001 … RFID-TAG-1008</p>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </article>

        <article className="panel">
          <h2>Scan result</h2>
          {!result ? (
            <p className="muted">Results appear here after a successful scan.</p>
          ) : (
            <div className="result-box">
              <p className="ok">{result.message}</p>
              <p>
                <strong>{result.asset.assetCode}</strong> — {result.asset.name}
              </p>
              <p>Location: {result.asset.location}</p>
              <p>
                Status: <StatusBadge status={result.asset.status} />
              </p>
              <p className="muted small">
                Last scanned: {new Date(result.asset.lastScannedAt).toLocaleString()}
              </p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
