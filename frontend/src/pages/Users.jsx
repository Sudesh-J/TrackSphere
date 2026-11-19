import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'Staff',
  });

  async function load() {
    try {
      const data = await apiRequest('/api/users', { token });
      setUsers(data.users);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function createUser(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/users', { method: 'POST', token, body: form });
      setSuccess('User created');
      setForm({ email: '', displayName: '', password: '', role: 'Staff' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeRole(id, role) {
    try {
      await apiRequest(`/api/users/${id}/role`, { method: 'PUT', token, body: { role } });
      setSuccess('Role updated');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Users & roles</h1>
          <p className="muted">Admin-only. Roles: Admin, Staff, Approver</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="ok">{success}</p> : null}
      <section className="split">
        <article className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.displayName}</td>
                    <td>
                      <StatusBadge status={u.role === 'Admin' ? 'in_use' : 'available'} /> {u.role}
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                      >
                        <option value="Admin">Admin</option>
                        <option value="Staff">Staff</option>
                        <option value="Approver">Approver</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel form-panel">
          <h2>Create user</h2>
          <form className="stack-form" onSubmit={createUser}>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label>
              Display name
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="Admin">Admin</option>
                <option value="Staff">Staff</option>
                <option value="Approver">Approver</option>
              </select>
            </label>
            <button className="btn btn-primary" type="submit">
              Create
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
