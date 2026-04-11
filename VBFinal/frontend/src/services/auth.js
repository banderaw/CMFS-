const normalizeApiBase = (rawBase) => {
  const trimmed = (rawBase || '/api').trim().replace(/\/+$/, '');
  if (trimmed === '/api' || trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
};

const API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_URL);
const AUTH_API_URL = `${API_BASE_URL}/accounts`;

class AuthService {
  async parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (isJson) {
      try {
        return await response.json();
      } catch {
        return {};
      }
    }

    const text = await response.text();
    return { detail: text || 'Unexpected server response' };
  }

  setAuthData(data) {
    if (data?.access) {
      localStorage.setItem('token', data.access);
    }
    if (data?.refresh) {
      localStorage.setItem('refresh', data.refresh);
    }
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
  }

  async login(identifier, password) {
    try {
      const response = await fetch(`${AUTH_API_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await this.parseResponse(response);

      if (!response.ok) {
        const detail = typeof data?.detail === 'string' ? data.detail : '';
        const isHtmlError = detail.startsWith('<!DOCTYPE') || detail.startsWith('<html');
        throw new Error(
          data?.non_field_errors?.[0]
          || (!isHtmlError ? detail : '')
          || `Login failed (HTTP ${response.status})`
        );
      }

      if (data.access) {
        this.setAuthData(data);
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

      const data = await this.parseResponse(response);

      if (!response.ok) {
        const errorMsg = typeof data === 'object'
          ? (Object.values(data).flat().join(', ') || 'Registration failed')
          : 'Registration failed';
        throw new Error(errorMsg);
      }

      if (data.access) {
        this.setAuthData(data);
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

      const data = await this.parseResponse(response);

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
    } catch {
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
