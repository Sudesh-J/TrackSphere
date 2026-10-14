import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Approvals() {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const data = await apiRequest('/api/approvals/pending', { token });
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function act(item, action) {
    setBusyId(`${item.entityType}-${item.id}-${action}`);
    setError('');
    try {
      const path =
        action === 'approve'
          ? item.approvePath
          : item.rejectPath;
      await apiRequest(path, {
        method: 'POST',
        token,
        body: {
          reviewedBy: user?.displayName || user?.email,
          comment: action === 'approve' ? 'Approved from TrackSphere UI' : 'Rejected from TrackSphere UI',
        },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Approvals</h1>
          <p className="muted">Pending transfer and retirement requests</p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <article className="panel">
        {items.length === 0 ? (
          <p className="muted">No pending approvals.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Asset</th>
                  <th>Summary</th>
                  <th>Requested by</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.entityType}-${item.id}`}>
                    <td>
                      <StatusBadge status={item.entityType === 'transfer' ? 'pending' : 'scrap'} />
                      <div className="muted small">{item.entityType}</div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <strong>{item.assetCode}</strong>
                        <span className="muted">{item.assetName}</span>
                      </div>
                    </td>
                    <td>{item.summary}</td>
                    <td>{item.requestedBy}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={Boolean(busyId)}
                        onClick={() => act(item, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={Boolean(busyId)}
                        onClick={() => act(item, 'reject')}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
