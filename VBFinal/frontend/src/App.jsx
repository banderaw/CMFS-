import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { MaintenanceProvider, useMaintenanceMode } from './contexts/MaintenanceContext';
import ProtectedRoute from './components/ProtectedRoute';
import TokenInterceptor from './components/TokenInterceptor';
import MaintenancePage from './components/MaintenancePage';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import RegisterComplete from './pages/RegisterComplete';
import AuthSuccess from './pages/AuthSuccess';
import AdminDashboard from './pages/AdminDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import UserDashboard from './pages/UserDashboard';


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
    <Routes>
      {/* Public Routes */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register/complete" element={<RegisterComplete />} />
      <Route path="/auth/success" element={<AuthSuccess />} />

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
                <div className="App">
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
