import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../auth';
import Alert from '../components/Alert';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@tracksphere.demo');
  const [password, setPassword] = useState('Demo@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = location.state?.from || '/';

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero" aria-hidden="true">
        <span className="brand-mark">
          <Shield size={18} />
        </span>
        <h1>Track assets with clarity</h1>
        <p>
          Handovers, valuations, approvals, and device health in one calm operational workspace.
        </p>
      </section>

      <section className="login-side">
        <form className="login-panel" onSubmit={handleSubmit}>
          <p className="login-brand">TrackSphere</p>
          <h1>Sign in</h1>
          <p className="muted">Use your demo role account to explore the workspace.</p>

          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <Alert type="error">{error}</Alert>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="hint">
            <p className="muted">Demo accounts (password <code>Demo@123</code>):</p>
            <ul className="demo-accounts">
              <li>admin@tracksphere.demo — Admin</li>
              <li>staff@tracksphere.demo — Staff</li>
              <li>approver@tracksphere.demo — Approver</li>
            </ul>
          </div>
        </form>
      </section>
    </div>
  );
}
