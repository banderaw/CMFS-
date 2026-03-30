import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuth();

  useEffect(() => {
    const access = searchParams.get('access');
    const refresh = searchParams.get('refresh');

    if (access && refresh) {
      localStorage.setItem('token', access);
      localStorage.setItem('refresh', refresh);

      // Fetch user data
      fetch(`${API_BASE}/accounts/me/`, {
        headers: {
          'Authorization': `Bearer ${access}`
        }
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch user data: ${res.status} ${text}`);
          }
          return res.json();
        })
        .then(userData => {
          localStorage.setItem('user', JSON.stringify(userData));
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
        .catch((err) => {
          console.error("Auth Success Error:", err);
          // navigate('/login?error=auth_failed'); // Don't redirect immediately on error, let user see it or handle gracefully
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
