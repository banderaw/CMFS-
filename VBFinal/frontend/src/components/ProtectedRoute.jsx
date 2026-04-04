import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, getUserRole, isAuthenticated } = useAuth();

  if (!user || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && getUserRole() !== requiredRole) {
    const role = getUserRole();
    const canAccessAdmin = requiredRole === 'admin' && (role === 'admin' || user?.is_superuser);

    if (canAccessAdmin) {
      return children;
    }

    // Redirect to appropriate dashboard based on user role
    switch (role) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'officer':
        return <Navigate to="/officer" replace />;
      case 'user':
      default:
        return <Navigate to="/user" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
