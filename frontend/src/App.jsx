import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Allocations from './pages/Allocations';
import Transfers from './pages/Transfers';
import Retirements from './pages/Retirements';
import Approvals from './pages/Approvals';
import Analytics from './pages/Analytics';
import ScanHandover from './pages/ScanHandover';
import HandoverPage from './pages/HandoverPage';
import Reports from './pages/Reports';
import Employees from './pages/Employees';
import Users from './pages/Users';
import InvoiceIntake from './pages/InvoiceIntake';
import Assistant from './pages/Assistant';
import DeviceHealth from './pages/DeviceHealth';
import Activity from './pages/Activity';
import NpvCalculator from './pages/NpvCalculator';

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (user && !roles.includes(user.role) && user.role !== 'Admin') {
    return (
      <div className="page">
        <p className="error">Forbidden for role {user.role}. Required: {roles.join(', ')}.</p>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/handover/:token"
            element={
              <Protected>
                <HandoverPage />
              </Protected>
            }
          />
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
            <Route
              path="scan"
              element={
                <RoleRoute roles={['Staff', 'Admin']}>
                  <ScanHandover />
                </RoleRoute>
              }
            />
            <Route path="reports" element={<Reports />} />
            <Route path="allocations" element={<Allocations />} />
            <Route path="transfers" element={<Transfers />} />
            <Route path="retirements" element={<Retirements />} />
            <Route
              path="approvals"
              element={
                <RoleRoute roles={['Approver', 'Admin']}>
                  <Approvals />
                </RoleRoute>
              }
            />
            <Route path="employees" element={<Employees />} />
            <Route
              path="users"
              element={
                <RoleRoute roles={['Admin']}>
                  <Users />
                </RoleRoute>
              }
            />
            <Route
              path="invoice"
              element={
                <RoleRoute roles={['Staff', 'Admin']}>
                  <InvoiceIntake />
                </RoleRoute>
              }
            />
            <Route path="assistant" element={<Assistant />} />
            <Route path="device-health" element={<DeviceHealth />} />
            <Route path="activity" element={<Activity />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="npv" element={<NpvCalculator />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
