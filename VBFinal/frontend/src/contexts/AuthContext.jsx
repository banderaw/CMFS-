/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/auth';
import apiService from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const initializeAuth = useCallback(async () => {
    const currentUser = authService.getCurrentUser();
    const token = authService.getToken();

    if (currentUser && token) {
      setUser(currentUser);
      apiService.setToken(token);

      // Verify token in background, don't block UI
      authService.verifyToken().then(isValid => {
        if (!isValid) {
          // Try to refresh token silently
          authService.refreshToken().catch(() => {
            // Only logout if refresh also fails
            logout();
          });
        }
      }).catch(() => {
        // Ignore verification errors on page load
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = async (identifier, password) => {
    try {
      const response = await authService.login(identifier, password);
      setUser(response.user);
      apiService.setToken(response.access);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      if (response.user) {
        setUser(response.user);
        apiService.setToken(response.access);
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  const setAuth = (userData, accessToken) => {
    setUser(userData);
    authService.setAuthData({
      user: userData,
      access: accessToken,
    });
    if (accessToken) {
      apiService.setToken(accessToken);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    apiService.setToken(null);
  };

  const getUserRole = () => {
    return user?.role || authService.getUserRole();
  };

  const isSuperAdmin = () => false;
  const isAdmin = () => getUserRole() === 'admin' || user?.is_superuser;
  const isOfficer = () => getUserRole() === 'officer';
  const isUser = () => getUserRole() === 'user';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      setAuth,
      getUserRole,
      isAdmin,
      isSuperAdmin,
      isOfficer,
      isUser,
      isAuthenticated: !!user,
      refreshToken: authService.refreshToken.bind(authService),
      verifyToken: authService.verifyToken.bind(authService)
    }}>
      {children}
    </AuthContext.Provider>
  );
};
