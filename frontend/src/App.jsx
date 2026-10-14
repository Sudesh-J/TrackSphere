import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Allocations from './pages/Allocations';
import Transfers from './pages/Transfers';
import Retirements from './pages/Retirements';
import Approvals from './pages/Approvals';
import RfidScan from './pages/RfidScan';
import Agents from './pages/Agents';
import Analytics from './pages/Analytics';

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="assets" element={<Assets />} />
            <Route path="allocations" element={<Allocations />} />
            <Route path="transfers" element={<Transfers />} />
            <Route path="retirements" element={<Retirements />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="rfid" element={<RfidScan />} />
            <Route path="agents" element={<Agents />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
