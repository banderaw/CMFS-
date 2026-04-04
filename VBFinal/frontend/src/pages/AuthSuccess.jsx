import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/auth';
import apiService from '../services/api';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuth();

  useEffect(() => {
    const access = searchParams.get('access');
    const refresh = searchParams.get('refresh');

    if (access && refresh) {
      authService.setAuthData({ access, refresh });
      apiService.setToken(access);

      apiService.getCurrentUserProfile()
        .then(userData => {
          authService.setAuthData({ access, refresh, user: userData });
          setAuth(userData, access);

          // Role-based redirection
          const role = userData.role;
          if (role === 'admin') {
            navigate('/admin');
          } else if (role === 'officer') {
            navigate('/officer');
          } else {
            navigate('/user');
          }
        })
        .catch(() => {
          alert("Authentication successful, but failed to load user profile. Please try logging in again.");
          navigate('/login');
        });
    } else {
      navigate('/login?error=missing_tokens');
    }
  }, [navigate, searchParams, setAuth]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;
