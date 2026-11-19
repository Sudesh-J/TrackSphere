import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest, getApiUrl } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function HandoverPage() {
  const { token: qrToken } = useParams();
  const { token, isStaff, user } = useAuth();
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [returnBy, setReturnBy] = useState('');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const bundle = await apiRequest(`/api/handover/token/${qrToken}`, { token });
      setData(bundle);
      const emp = await apiRequest('/api/employees', { token });
      setEmployees(emp.employees);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [qrToken, token]);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  });

  function prepareAssign(e) {
    e.preventDefault();
    if (!employeeId) {
      setError('Select an employee');
      return;
    }
    const emp = employees.find((x) => String(x.id) === String(employeeId));
    setDraft({
      type: 'assign',
      asset: data.asset,
      employee: emp,
      returnBy,
      notes,
      date: new Date().toISOString(),
    });
    setError('');
    setSuccess('');
  }

  async function confirmAssign() {
    try {
      await apiRequest('/api/handover/assign', {
        method: 'POST',
        token,
        body: {
          assetId: data.asset.id,
          employeeId: Number(employeeId),
          returnBy: returnBy || null,
          notes: notes || null,
          confirmed: true,
        },
      });
      setSuccess(`Handover completed by ${user.displayName}`);
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmReturn() {
    try {
      await apiRequest('/api/handover/return', {
        method: 'POST',
        token,
        body: {
          allocationId: data.currentAllocation.id,
          confirmed: true,
        },
      });
      setSuccess(`Return processed by ${user.displayName}`);
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="page mobile-page"><p className="muted">Loading asset…</p></div>;
  if (error && !data) {
    return (
      <div className="page mobile-page">
        <p className="error">{error}</p>
        <Link to="/">Back to app</Link>
      </div>
    );
  }

  const asset = data.asset;
  const photoSrc = asset.photoUrl
    ? `${getApiUrl()}${asset.photoUrl}?access_token=${encodeURIComponent(token)}`
    : null;

  return (
    <div className="page mobile-page">
      <header className="page-header">
        <div>
          <p className="muted">QR asset handover</p>
          <h1>{asset.name}</h1>
          <p>
            <code>{asset.assetCode}</code> · <StatusBadge status={asset.status} />
          </p>
        </div>
        <Link className="btn btn-secondary" to="/">
          Dashboard
        </Link>
      </header>

      {photoSrc ? <img className="asset-photo" src={photoSrc} alt={asset.name} /> : null}
      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}

      {data.currentAllocation ? (
        <article className="panel">
          <h2>Currently assigned</h2>
          <p>
            <strong>{data.currentAllocation.assigneeName}</strong>
            <br />
            {data.currentAllocation.assigneeEmail} · {data.currentAllocation.assigneeDepartment}
          </p>
          <p className="muted">
            Since {new Date(data.currentAllocation.allocatedAt).toLocaleString()}
            {data.currentAllocation.returnBy
              ? ` · expected return ${data.currentAllocation.returnBy}`
              : ''}
          </p>
          {isStaff ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                setDraft({
                  type: 'return',
                  asset,
                  allocation: data.currentAllocation,
                  date: new Date().toISOString(),
                })
              }
            >
              Process return
            </button>
          ) : (
            <p className="muted">Only Staff/Admin can process returns.</p>
          )}
        </article>
      ) : asset.status === 'available' && isStaff ? (
        <article className="panel form-panel">
          <h2>Assign to employee</h2>
          <form className="stack-form" onSubmit={prepareAssign}>
            <label>
              Search employees
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, department"
              />
            </label>
            <label>
              Employee
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {filtered.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} — {e.email} ({e.department})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expected return date
              <input type="date" value={returnBy} onChange={(e) => setReturnBy(e.target.value)} />
            </label>
            <label>
              Notes
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <button className="btn btn-primary" type="submit">
              Review handover
            </button>
          </form>
        </article>
      ) : (
        <article className="panel">
          <p>
            Asset status is <StatusBadge status={asset.status} /> — handover is not available.
          </p>
          {!isStaff ? <p className="muted">Staff or Admin role required to assign.</p> : null}
        </article>
      )}

      {draft ? (
        <div className="modal-backdrop">
          <div className="modal panel">
            <h2>Confirm {draft.type === 'assign' ? 'handover' : 'return'}</h2>
            <p>
              <strong>{draft.asset.assetCode}</strong> — {draft.asset.name}
            </p>
            {draft.type === 'assign' ? (
              <>
                <p>Recipient: {draft.employee.fullName} ({draft.employee.email})</p>
                <p>Date: {new Date(draft.date).toLocaleString()}</p>
                <p>Expected return: {draft.returnBy || '—'}</p>
                <p>Notes: {draft.notes || '—'}</p>
                <p className="muted">Performed by: {user.displayName} (from session)</p>
              </>
            ) : (
              <>
                <p>Return from: {draft.allocation.assigneeName}</p>
                <p>Date: {new Date(draft.date).toLocaleString()}</p>
                <p className="muted">Processed by: {user.displayName}</p>
              </>
            )}
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={draft.type === 'assign' ? confirmAssign : confirmReturn}
              >
                Confirm
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
