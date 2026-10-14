import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('admin@tracksphere.demo');
  const [password, setPassword] = useState('Demo@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <p className="login-brand">TrackSphere</p>
        <h1>Sign in</h1>
        <p className="muted">Student asset-management prototype</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="hint">Demo: admin@tracksphere.demo / Demo@123</p>
      </form>
    </div>
  );
}
