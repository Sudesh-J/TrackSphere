import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

const EMPTY_FORM = {
  assetCode: '',
  name: '',
  category: '',
  location: '',
  rfidTagId: '',
  status: 'available',
};

export default function Assets() {
  const { token } = useAuth();
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    const qs = params.toString() ? `?${params}` : '';
    const data = await apiRequest(`/api/assets${qs}`, { token });
    setAssets(data.assets);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function handleFilter(e) {
    e.preventDefault();
    setError('');
    try {
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(asset) {
    setEditingId(asset.id);
    setForm({
      assetCode: asset.assetCode,
      name: asset.name,
      category: asset.category,
      location: asset.location,
      rfidTagId: asset.rfidTagId,
      status: asset.status,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await apiRequest(`/api/assets/${editingId}`, {
          method: 'PUT',
          token,
          body: {
            name: form.name,
            category: form.category,
            location: form.location,
            rfidTagId: form.rfidTagId,
            status: form.status,
          },
        });
      } else {
        await apiRequest('/api/assets', {
          method: 'POST',
          token,
          body: form,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Asset inventory</h1>
          <p className="muted">List, search, create, and update assets</p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <form className="toolbar" onSubmit={handleFilter}>
        <input
          placeholder="Search code, name, RFID, location…"
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

      <section className="split">
        <article className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>RFID</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td>{a.assetCode}</td>
                    <td>{a.name}</td>
                    <td>{a.category}</td>
                    <td>{a.location}</td>
                    <td>
                      <code>{a.rfidTagId}</code>
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => startEdit(a)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

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
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Category
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              />
            </label>
            <label>
              Location
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
              />
            </label>
            <label>
              RFID tag ID
              <input
                value={form.rfidTagId}
                onChange={(e) => setForm({ ...form, rfidTagId: e.target.value })}
                required
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="available">Available</option>
                <option value="in_use">In use</option>
                <option value="maintenance">Maintenance</option>
                <option value="missing">Missing</option>
                <option value="retired">Retired</option>
              </select>
            </label>
            <div className="row-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create asset'}
              </button>
              {editingId ? (
                <button type="button" className="btn btn-ghost" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </article>
      </section>
    </div>
  );
}
