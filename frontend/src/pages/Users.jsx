import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';

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
      <PageHeader title="Users & roles" description="Admin-only. Roles: Admin, Staff, Approver" />
      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>
      <section className="split">
        <article className="panel">
          <div className="table-wrap">
            {users.length === 0 ? (
              <EmptyState title="No users" />
            ) : (
            <table className="table-responsive">
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
                    <td data-label="Email">{u.email}</td>
                    <td data-label="Name">{u.displayName}</td>
                    <td data-label="Role">
                      <StatusBadge status={u.role === 'Admin' ? 'in_use' : 'available'} /> {u.role}
                    </td>
                    <td data-label="Change">
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
            )}
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
