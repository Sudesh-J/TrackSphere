import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';

export default function Activity() {
  const { token } = useAuth();
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest('/api/activity?limit=100', { token })
      .then((d) => setActivities(d.activities))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Activity history</h1>
          <p className="muted">Actor comes from the authenticated session</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && activities.length === 0 ? <p className="muted">No activity yet.</p> : null}
      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.createdAt).toLocaleString()}</td>
                  <td>{a.actorName || '—'}</td>
                  <td>
                    <code>{a.action}</code>
                  </td>
                  <td>{a.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
