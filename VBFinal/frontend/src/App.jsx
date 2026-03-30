import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { MaintenanceProvider, useMaintenanceMode } from './contexts/MaintenanceContext';
import ProtectedRoute from './components/ProtectedRoute';
import TokenInterceptor from './components/TokenInterceptor';
import MaintenancePage from './components/MaintenancePage';
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const RegisterComplete = lazy(() => import('./pages/RegisterComplete'));
const AuthSuccess = lazy(() => import('./pages/AuthSuccess'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const OfficerDashboard = lazy(() => import('./pages/OfficerDashboard'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));

// Simple loading fallback
const RouteLoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-gray-100">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);


// Component to handle root redirect based on auth status
const RootRedirect = () => {
  const { user, getUserRole } = useAuth();

  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  const role = getUserRole();
  switch (role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'officer':
      return <Navigate to="/officer" replace />;
    case 'user':
    default:
      return <Navigate to="/user" replace />;
  }
};

// Component to handle maintenance mode and routing
const AppContent = () => {
  const { isMaintenanceMode, maintenanceMessage } = useMaintenanceMode();
  const { user, getUserRole } = useAuth();

  // Show maintenance page if maintenance mode is enabled and user is not admin
  if (isMaintenanceMode && (!user || getUserRole() !== 'admin')) {
    return <MaintenancePage message={maintenanceMessage} />;
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register/complete" element={<RegisterComplete />} />
        <Route path="/auth/success" element={<AuthSuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/officer"
          element={
            <ProtectedRoute requiredRole="officer">
              <OfficerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user"
          element={
            <ProtectedRoute requiredRole="user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />

        {/* Default Route */}
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <MaintenanceProvider>
          <AuthProvider>
            <TokenInterceptor>
              <Router>
                <div className="App min-h-screen bg-inherit pt-20 pb-56">
                  <AppContent />
                </div>
              </Router>
            </TokenInterceptor>
          </AuthProvider>
        </MaintenanceProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
