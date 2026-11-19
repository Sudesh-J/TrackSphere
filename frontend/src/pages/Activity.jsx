import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import LoadingBlock from '../components/LoadingBlock';
import EmptyState from '../components/EmptyState';

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
      <PageHeader title="Activity history" description="Actor comes from the authenticated session" />
      <Alert type="error">{error}</Alert>
      {loading ? <LoadingBlock label="Loading activity…" /> : null}
      <article className="panel">
        <div className="table-wrap">
          {!loading && activities.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
          <table className="table-responsive">
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
                  <td data-label="When">{new Date(a.createdAt).toLocaleString()}</td>
                  <td data-label="Actor">{a.actorName || '—'}</td>
                  <td data-label="Action">
                    <code>{a.action}</code>
                  </td>
                  <td data-label="Summary">{a.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </article>
    </div>
  );
}
