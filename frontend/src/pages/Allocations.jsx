import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Allocations() {
  const { token, isStaff } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ assetId: '', employeeId: '', returnBy: '', notes: '' });

  async function load() {
    const [a, assetsRes, emp] = await Promise.all([
      apiRequest('/api/allocations', { token }),
      apiRequest('/api/assets?status=available', { token }),
      apiRequest('/api/employees', { token }),
    ]);
    setAllocations(a.allocations);
    setAssets(assetsRes.assets);
    setEmployees(emp.employees);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/allocations', {
        method: 'POST',
        token,
        body: {
          assetId: Number(form.assetId),
          employeeId: Number(form.employeeId),
          returnBy: form.returnBy || null,
          notes: form.notes || null,
        },
      });
      setSuccess('Allocation created');
      setForm({ assetId: '', employeeId: '', returnBy: '', notes: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReturn(id) {
    try {
      await apiRequest(`/api/allocations/${id}/return`, { method: 'POST', token });
      setSuccess('Returned');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Allocations</h1>
          <p className="muted">Prefer QR handover for phone workflows; this page remains available</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}
      <section className="split">
        <article className="panel">
          {allocations.length === 0 ? <p className="muted">No allocations.</p> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Assigned to</th>
                  <th>Return by</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allocations.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.assetCode} — {row.assetName}
                    </td>
                    <td>{row.assignedTo}</td>
                    <td>{row.returnBy || '—'}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      {row.status === 'allocated' && isStaff ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleReturn(row.id)}
                        >
                          Return
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        {isStaff ? (
          <article className="panel form-panel">
            <h2>Allocate</h2>
            <form className="stack-form" onSubmit={handleCreate}>
              <label>
                Asset
                <select
                  value={form.assetId}
                  onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                  required
                >
                  <option value="">Select</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Employee
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  required
                >
                  <option value="">Select</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.department})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Return by
                <input
                  type="date"
                  value={form.returnBy}
                  onChange={(e) => setForm({ ...form, returnBy: e.target.value })}
                />
              </label>
              <label>
                Notes
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <button className="btn btn-primary" type="submit">
                Allocate
              </button>
            </form>
          </article>
        ) : null}
      </section>
    </div>
  );
}
