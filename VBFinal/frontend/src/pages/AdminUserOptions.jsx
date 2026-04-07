import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';

const ADMIN_MENU_ITEMS = [
  { id: 'overview', name: 'Dashboard', icon: '📊' },
  { id: 'complaints', name: 'Complaints', icon: '📝' },
  { id: 'institutions', name: 'Institutions', icon: '🏛️' },
  { id: 'users', name: 'Users', icon: '👤' },
  { id: 'feedback-templates', name: 'Feedback Templates', icon: '📋' },
  { id: 'contact', name: 'Contact', icon: '✉️' },
  { id: 'system', name: 'System', icon: '⚙️' },
  { id: 'profile', name: 'Profile', icon: '👤' },
];

const getRoleLabel = (code) => {
  if (!code) return 'Unknown';
  return code.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const AdminUserOptions = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { isDark } = useTheme();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getAllUsers();
      const usersList = data.results || data || [];
      const matchedUser = usersList.find((item) => String(item.id) === String(userId));

      if (!matchedUser) {
        throw new Error('User not found');
      }

      setUser(matchedUser);
    } catch (error) {
      console.error('Failed to load user options:', error);
      window.alert('Failed to load user options');
      navigate('/admin?tab=users');
    } finally {
      setLoading(false);
    }
  }, [navigate, userId]);

  useEffect(() => {
    if (!userId) {
      navigate('/admin?tab=users');
      return;
    }
    loadUser();
  }, [loadUser, navigate, userId]);

  const handleBackToUsers = () => {
    navigate('/admin?tab=users');
  };

  const handleToggleUserStatus = async () => {
    if (!user || actionLoading) return;

    try {
      setActionLoading(true);
      const nextStatus = !user.is_active;
      await apiService.updateUser(user.id, { is_active: nextStatus });
      setUser((prev) => ({ ...prev, is_active: nextStatus }));
    } catch (error) {
      console.error('Failed to update user status:', error);
      window.alert('Failed to update user status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user || actionLoading) return;

    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      await apiService.deleteUser(user.id);
      window.alert('User deleted successfully');
      navigate('/admin?tab=users');
    } catch (error) {
      console.error('Failed to delete user:', error);
      window.alert('Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSidebarToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarCollapsed((prev) => !prev);
      return;
    }
    setSidebarOpen((prev) => !prev);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="text-lg text-gray-500">Loading user options...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <DashboardNavbar onSidebarToggle={handleSidebarToggle} />

      <div className="flex pt-20">
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isDesktopSidebarCollapsed}
          items={ADMIN_MENU_ITEMS}
          activeItem="users"
          onItemClick={(id) => {
            navigate(`/admin?tab=${id}`, { replace: true });
            setSidebarOpen(false);
          }}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => {
            navigate('/admin?tab=profile', { replace: true });
            setSidebarOpen(false);
          }}
          onHideSidebar={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
          showBottomSection={false}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20 top-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className={`flex-1 ${isDesktopSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>User Options</h1>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Manage account settings for {user.first_name} {user.last_name}
                </p>
              </div>
              <button
                type="button"
                onClick={handleBackToUsers}
                className={`px-4 py-2 rounded-md border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                Back to Users
              </button>
            </div>

            <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Name</p>
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.first_name} {user.last_name}</p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Role</p>
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{getRoleLabel(user.role)}</p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Email</p>
                  <p className={`${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{user.email || 'N/A'}</p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</p>
                  <p className={`font-semibold ${user.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </section>

            <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6`}>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Actions</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleToggleUserStatus}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-md text-white disabled:opacity-50 ${user.is_active ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {user.is_active ? 'Deactivate User' : 'Activate User'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete User
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminUserOptions;
