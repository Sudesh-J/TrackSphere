import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';

export default function Employees() {
  const { token, isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    department: '',
  });

  async function load() {
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await apiRequest(`/api/employees${qs}`, { token });
      setEmployees(data.employees);
      setNote(data.note || '');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function createEmployee(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/employees', { method: 'POST', token, body: form });
      setForm({ employeeCode: '', fullName: '', email: '', department: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Employees</h1>
          <p className="muted">{note || 'Handover recipients (no login accounts)'}</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          placeholder="Search name, email, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>
      <section className="split">
        <article className="panel">
          {employees.length === 0 ? <p className="muted">No employees found.</p> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td>{e.employeeCode}</td>
                    <td>{e.fullName}</td>
                    <td>{e.email}</td>
                    <td>{e.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        {isAdmin ? (
          <article className="panel form-panel">
            <h2>Add employee</h2>
            <form className="stack-form" onSubmit={createEmployee}>
              {['employeeCode', 'fullName', 'email', 'department'].map((k) => (
                <label key={k}>
                  {k}
                  <input
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    required
                  />
                </label>
              ))}
              <button className="btn btn-primary" type="submit">
                Create
              </button>
            </form>
          </article>
        ) : null}
      </section>
    </div>
  );
}
