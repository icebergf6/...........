import React, { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProspectsProvider } from './context/ProspectsContext';
import { AttendanceProvider } from './context/AttendanceContext';
import { PaymentAccountsProvider } from './context/PaymentAccountsContext';
import { NotificationsProvider } from './context/NotificationsContext';
import DashboardLayout from './components/Layout/DashboardLayout';

// Dynamic lazy-loaded pages for sub-second initial load and efficient bundle splitting
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const ProspectsPage = lazy(() => import('./pages/ProspectsPage'));
const DealsFinancePage = lazy(() => import('./pages/DealsFinancePage'));
const ManagedHostingPage = lazy(() => import('./pages/ManagedHostingPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const GuidePage = lazy(() => import('./pages/GuidePage'));

function PageLoadingFallback() {
  return (
    <div
      className="d-flex align-items-center justify-content-center p-5 text-muted"
      style={{ minHeight: '60vh', fontSize: '13.5px' }}
    >
      <div className="spinner-border spinner-border-sm text-secondary me-2" role="status" />
      <span>Memuat halaman...</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 text-muted">
        Memuat ruang kerja...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function PublicAuthRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/prospects" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 text-muted">
        Memverifikasi hak akses...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/prospects" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ProspectsProvider>
        <AttendanceProvider>
          <PaymentAccountsProvider>
            <NotificationsProvider>
              <BrowserRouter>
                <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                    {/* Halaman pertama saat URL dibuka: /auth jika belum login */}
                    <Route
                      path="/auth"
                      element={
                        <PublicAuthRoute>
                          <AuthPage />
                        </PublicAuthRoute>
                      }
                    />

                    {/* Halaman Dashboard dengan Sidebar */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="/prospects" replace />} />
                      <Route path="attendance" element={<AttendancePage />} />
                      <Route path="prospects" element={<ProspectsPage />} />
                      <Route path="deals" element={<DealsFinancePage />} />
                      <Route path="managed-hosting" element={<ManagedHostingPage />} />
                      <Route path="leaderboard" element={<LeaderboardPage />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="guide" element={<GuidePage />} />
                      <Route path="panduan" element={<Navigate to="/guide" replace />} />
                      
                      {/* Halaman Khusus Admin (RBAC Protected) */}
                      <Route
                        path="admin"
                        element={
                          <AdminRoute>
                            <AdminPage defaultTab="overview" />
                          </AdminRoute>
                        }
                      />
                      <Route
                        path="admin/projects"
                        element={
                          <AdminRoute>
                            <AdminPage defaultTab="projects" />
                          </AdminRoute>
                        }
                      />
                      <Route
                        path="admin/users-lifecycle"
                        element={
                          <AdminRoute>
                            <AdminPage defaultTab="lifecycle" />
                          </AdminRoute>
                        }
                      />
                      <Route
                        path="admin/audit"
                        element={
                          <AdminRoute>
                            <AdminPage defaultTab="audit" />
                          </AdminRoute>
                        }
                      />
                    </Route>

                    <Route path="*" element={<Navigate to="/auth" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </NotificationsProvider>
          </PaymentAccountsProvider>
        </AttendanceProvider>
      </ProspectsProvider>
    </AuthProvider>
  );
}
