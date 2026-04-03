import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TokenInterceptor = ({ children }) => {
  const { user, logout, verifyToken, refreshToken } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Check token validity every 5 minutes
    const interval = setInterval(async () => {
      try {
        const isValid = await verifyToken();
        if (!isValid) {
          // Try to refresh token before logging out
          try {
            await refreshToken();
            console.log('Token refreshed successfully');
          } catch {
            console.log('Token refresh failed, logging out...');
            logout();
          }
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        // Try refresh as fallback
        try {
          await refreshToken();
        } catch {
          logout();
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, logout, verifyToken, refreshToken]);

  return children;
};

export default TokenInterceptor;
