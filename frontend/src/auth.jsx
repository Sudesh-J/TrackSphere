import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { apiRequest } from './api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'tracksphere_auth';

function loadStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const initial = loadStored();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);

  useEffect(() => {
    if (token && user) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [token, user]);

  async function login(email, password) {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function hasRole(...roles) {
    return Boolean(user && roles.includes(user.role));
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
      hasRole,
      isAdmin: user?.role === 'Admin',
      isStaff: user?.role === 'Staff' || user?.role === 'Admin',
      isApprover: user?.role === 'Approver' || user?.role === 'Admin',
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
