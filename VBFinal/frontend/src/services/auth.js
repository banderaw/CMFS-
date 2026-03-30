const AUTH_API_URL = `${import.meta.env.VITE_API_URL || "/api"}/accounts`;

class AuthService {
  async login(identifier, password) {
    try {
      const response = await fetch(`${AUTH_API_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.non_field_errors?.[0] || data.detail || 'Login failed');
      }

      if (data.access) {
        localStorage.setItem('token', data.access);
        localStorage.setItem('refresh', data.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
      }

      throw new Error('No token received');
    } catch (error) {
      throw error;
    }
  }

  async register(userData) {
    try {
      const response = await fetch(`${AUTH_API_URL}/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = Object.values(data).flat().join(', ') || 'Registration failed';
        throw new Error(errorMsg);
      }

      if (data.access) {
        localStorage.setItem('token', data.access);
        localStorage.setItem('refresh', data.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refresh');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${AUTH_API_URL}/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Token refresh failed');
      }

      if (data.access) {
        localStorage.setItem('token', data.access);
        // If rotation is enabled, update refresh token too
        if (data.refresh) {
          localStorage.setItem('refresh', data.refresh);
        }
        return data.access;
      }

      throw new Error('No access token received');
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  async verifyToken() {
    try {
      const token = this.getToken();
      if (!token) return false;

      const response = await fetch(`${AUTH_API_URL}/token/verify/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  getUserRole() {
    const user = this.getCurrentUser();
    return user?.role || null;
  }

  getRoleBasedRoute() {
    const role = this.getUserRole();
    switch (role) {
      case 'admin':
        return '/admin';
      case 'officer':
        return '/officer';
      case 'user':
      default:
        return '/user';
    }
  }
}

export default new AuthService();
