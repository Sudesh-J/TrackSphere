import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, getApiUrl } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import LoadingBlock from '../components/LoadingBlock';
import EmptyState from '../components/EmptyState';

const EMPTY = {
  assetCode: '',
  name: '',
  category: '',
  location: '',
  status: 'available',
  vendor: '',
  serialNumber: '',
  purchaseCost: '',
  purchaseDate: '',
  residualValue: '0',
  usefulLifeYears: '4',
};

export default function Assets() {
  const { token, isAdmin, isStaff } = useAuth();
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      const qs = params.toString() ? `?${params}` : '';
      const data = await apiRequest(`/api/assets${qs}`, { token });
      setAssets(data.assets);
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

  async function handleSave(e) {
    e.preventDefault();
    if (!isAdmin) return;
    setError('');
    setSuccess('');
    try {
      const body = {
        ...form,
        purchaseCost: form.purchaseCost === '' ? null : Number(form.purchaseCost),
        residualValue: form.residualValue === '' ? 0 : Number(form.residualValue),
        usefulLifeYears: form.usefulLifeYears === '' ? null : Number(form.usefulLifeYears),
      };
      if (editingId) {
        await apiRequest(`/api/assets/${editingId}`, { method: 'PUT', token, body });
        setSuccess('Asset updated');
      } else {
        await apiRequest('/api/assets', { method: 'POST', token, body });
        setSuccess('Asset created');
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(a) {
    setEditingId(a.id);
    setForm({
      assetCode: a.assetCode,
      name: a.name,
      category: a.category,
      location: a.location,
      status: a.status,
      vendor: a.vendor || '',
      serialNumber: a.serialNumber || '',
      purchaseCost: a.purchaseCost ?? '',
      purchaseDate: a.purchaseDate ? String(a.purchaseDate).slice(0, 10) : '',
      residualValue: a.residualValue ?? 0,
      usefulLifeYears: a.usefulLifeYears ?? '',
    });
  }

  async function uploadPhoto(assetId, file) {
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await apiRequest(`/api/assets/${assetId}/photo`, { method: 'POST', token, formData: fd });
      setSuccess('Photo uploaded');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Asset register"
        description="Inventory with valuation fields, QR handover links, and photos"
      />

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="in_use">In use</option>
          <option value="maintenance">Maintenance</option>
          <option value="missing">Missing</option>
          <option value="retired">Retired</option>
        </select>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      {loading ? <LoadingBlock label="Loading assets…" /> : null}

      <section className="split">
        <article className="panel">
          <div className="table-wrap">
            {!loading && assets.length === 0 ? (
              <EmptyState title="No assets match" description="Try different filters or create a new asset." />
            ) : (
            <table className="table-responsive">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>NBV</th>
                  <th>QR / Photo</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Asset">
                      <div className="cell-stack">
                        <strong>{a.assetCode}</strong>
                        <span>{a.name}</span>
                        <span className="muted small">{a.category}</span>
                      </div>
                    </td>
                    <td data-label="Location">{a.location}</td>
                    <td data-label="Status">
                      <StatusBadge status={a.status} />
                    </td>
                    <td data-label="Assignee">{a.currentAssignee || '—'}</td>
                    <td data-label="NBV">{a.nbv != null ? a.nbv : '—'}</td>
                    <td data-label="QR / Photo">
                      <div className="row-actions">
                        <Link className="btn btn-ghost" to={`/handover/${a.qrToken}`}>
                          Handover
                        </Link>
                        <a
                          className="btn btn-ghost"
                          href={`${getApiUrl()}/api/assets/${a.id}/qr.png?access_token=${encodeURIComponent(token)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          QR
                        </a>
                        {isAdmin ? (
                          <button type="button" className="btn btn-ghost" onClick={() => startEdit(a)}>
                            Edit
                          </button>
                        ) : null}
                        {isStaff ? (
                          <label className="btn btn-ghost file-btn">
                            Photo
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              hidden
                              onChange={(e) => {
                                if (e.target.files?.[0]) uploadPhoto(a.id, e.target.files[0]);
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                      {a.photoUrl ? (
                        <img
                          className="thumb"
                          src={`${getApiUrl()}${a.photoUrl}?access_token=${encodeURIComponent(token)}`}
                          alt=""
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </article>

        {isAdmin ? (
          <article className="panel form-panel">
            <h2>{editingId ? 'Update asset' : 'Create asset'}</h2>
            <form className="stack-form" onSubmit={handleSave}>
              {!editingId ? (
                <label>
                  Asset code
                  <input
                    value={form.assetCode}
                    onChange={(e) => setForm({ ...form, assetCode: e.target.value })}
                    required
                  />
                </label>
              ) : null}
              {['name', 'category', 'location', 'vendor', 'serialNumber'].map((key) => (
                <label key={key}>
                  {key}
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required={['name', 'category', 'location'].includes(key)}
                  />
                </label>
              ))}
              <label>
                Status
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="available">available</option>
                  <option value="in_use">in_use</option>
                  <option value="maintenance">maintenance</option>
                  <option value="missing">missing</option>
                  <option value="retired">retired</option>
                </select>
              </label>
              <label>
                Purchase cost
                <input
                  type="number"
                  step="0.01"
                  value={form.purchaseCost}
                  onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })}
                />
              </label>
              <label>
                Purchase date
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                />
              </label>
              <label>
                Residual value
                <input
                  type="number"
                  step="0.01"
                  value={form.residualValue}
                  onChange={(e) => setForm({ ...form, residualValue: e.target.value })}
                />
              </label>
              <label>
                Useful life (years)
                <input
                  type="number"
                  step="0.1"
                  value={form.usefulLifeYears}
                  onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })}
                />
              </label>
              <div className="row-actions">
                <button className="btn btn-primary" type="submit">
                  {editingId ? 'Save' : 'Create'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingId(null);
                      setForm(EMPTY);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </article>
        ) : null}
      </section>
    </div>
  );
}
