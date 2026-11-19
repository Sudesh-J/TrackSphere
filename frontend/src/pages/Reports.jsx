import { useEffect, useState } from 'react';
import { apiRequest, getApiUrl } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import LoadingBlock from '../components/LoadingBlock';
import EmptyState from '../components/EmptyState';

export default function Reports() {
  const { token } = useAuth();
  const [filters, setFilters] = useState({
    location: '',
    category: '',
    status: '',
    employeeId: '',
  });
  const [employees, setEmployees] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiRequest('/api/employees', { token })
      .then((d) => setEmployees(d.employees))
      .catch(() => {});
  }, [token]);

  async function runReport(e) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const data = await apiRequest(`/api/reports/assets?${params}`, { token });
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set('access_token', token);
    window.open(`${getApiUrl()}/api/reports/assets.csv?${params}`, '_blank');
  }

  return (
    <div className="page">
      <PageHeader
        title="Asset reports"
        description="Filterable register with NBV (straight-line). Separate from NPV calculator."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!report}>
              Export CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              Print / Save PDF
            </button>
          </>
        }
      />

      <form className="toolbar print-hide" onSubmit={runReport}>
        <input
          placeholder="Location"
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
        />
        <input
          placeholder="Category"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="available">available</option>
          <option value="in_use">in_use</option>
          <option value="maintenance">maintenance</option>
          <option value="missing">missing</option>
          <option value="retired">retired</option>
        </select>
        <select
          value={filters.employeeId}
          onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
        >
          <option value="">Any assignee</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Run report
        </button>
      </form>

      <Alert type="error">{error}</Alert>
      {loading ? <LoadingBlock label="Building report…" /> : null}

      {report ? (
        <article className="panel print-area">
          <h2>TrackSphere asset report</h2>
          <p className="small muted">Generated {new Date(report.generatedAt).toLocaleString()}</p>
          <p className="small">{report.formula}</p>
          <div className="table-wrap">
            {report.rows.length === 0 ? (
              <EmptyState title="No rows for these filters" />
            ) : (
            <table className="table-responsive">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Last scan/handover</th>
                  <th>Cost</th>
                  <th>Accum. dep.</th>
                  <th>NBV</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.assetCode}>
                    <td data-label="Code">{r.assetCode}</td>
                    <td data-label="Name">{r.name}</td>
                    <td data-label="Location">{r.location}</td>
                    <td data-label="Status">
                      <StatusBadge status={r.status} />
                    </td>
                    <td data-label="Assignee">{r.currentAssignee || '—'}</td>
                    <td data-label="Last scan/handover">
                      {r.lastScanOrHandover
                        ? new Date(r.lastScanOrHandover).toLocaleString()
                        : '—'}
                    </td>
                    <td data-label="Cost">{r.purchaseCost ?? '—'}</td>
                    <td data-label="Accum. dep.">{r.accumulatedDepreciation ?? '—'}</td>
                    <td data-label="NBV">{r.nbv ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </article>
      ) : (
        <EmptyState title="No report yet" description="Run a report to see results." />
      )}
    </div>
  );
}
