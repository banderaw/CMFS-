import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const DashboardNavbar = ({ onSidebarToggle, showOfficerNotifications = false }) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout, getUserRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const currentRole = (getUserRole?.() || user?.role || '').toLowerCase();
  const shouldShowNotifications = showOfficerNotifications && currentRole === 'officer';

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.max(0, Math.floor((now - date) / (1000 * 60)));

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const loadNotifications = async () => {
    if (!shouldShowNotifications) return;

    setNotificationsLoading(true);
    try {
      const data = await apiService.getNotifications();
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setNotifications(
        list
          .slice()
          .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
          .slice(0, 8),
      );
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (!shouldShowNotifications) return;

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(interval);
  }, [shouldShowNotifications]);

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await apiService.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, is_read: true } : notification,
        ),
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    const role = getUserRole();
    if (role === 'admin') return '/admin';
    if (role === 'officer') return '/officer';
    return '/user';
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const firstName = user?.first_name || '';
    const lastName = user?.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const headerClasses = isDark
    ? 'bg-slate-950/90 border-slate-700/80'
    : 'bg-white/90 border-blue-100';
  const iconButtonClasses = isDark
    ? 'text-slate-300 hover:bg-blue-500/15 hover:text-blue-200'
    : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700';
  const activeLinkClasses = isDark
    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm';
  const defaultLinkClasses = isDark
    ? 'text-slate-300 hover:bg-blue-500/15 hover:text-blue-200'
    : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700';
  const userMenuTriggerClasses = isDark
    ? 'hover:bg-blue-500/15'
    : 'hover:bg-blue-50';
  const dividerClasses = isDark ? 'bg-slate-600' : 'bg-blue-100';

  return (
    <header className={`${headerClasses} backdrop-blur-md shadow-md border-b sticky top-0 left-0 right-0 z-50 w-full`}>
      <nav className="px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        {/* Left: Logo and Sidebar Toggle */}
        <div className="flex items-center space-x-6 min-w-0">
          <button
            onClick={onSidebarToggle}
            className={`p-2.5 rounded-lg transition-all duration-200 ${iconButtonClasses}`}
            title="Toggle Sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity duration-200" onClick={() => navigate(getDashboardPath())}>
            <div className="flex items-center space-x-3.5">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-lg shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  CMFTS
                </h1>
                <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  System
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <div className="hidden lg:flex items-center space-x-1">
          <Link
            to={getDashboardPath()}
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${location.pathname === getDashboardPath()
              ? activeLinkClasses
              : defaultLinkClasses
              }`}
          >
            Dashboard
          </Link>
          <Link
            to="/landing"
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${defaultLinkClasses}`}
          >
            Home
          </Link>
          <Link
            to="/landing#features"
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${defaultLinkClasses}`}
          >
            Features
          </Link>
          <Link
            to="/landing#about"
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${defaultLinkClasses}`}
          >
            About
          </Link>
          <Link
            to="/landing#contact"
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${defaultLinkClasses}`}
          >
            Contact
          </Link>
        </div>

        {/* Right: Theme Toggle and User Menu */}
        <div className="flex items-center space-x-3">
          {shouldShowNotifications && (
            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setDropdownOpen(false);
                }}
                className={`relative p-2.5 rounded-lg transition-all duration-200 ${iconButtonClasses}`}
                title="Notifications"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div
                  className={`absolute right-0 mt-3 w-80 rounded-xl shadow-xl py-2 z-50 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} backdrop-blur-sm`}
                >
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Notifications</p>
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className={`text-xs font-medium ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'}`}
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notificationsLoading ? (
                      <p className={`px-4 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading notifications...</p>
                    ) : notifications.length === 0 ? (
                      <p className={`px-4 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No notifications yet.</p>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={async () => {
                            if (!notification.is_read) {
                              await handleMarkNotificationRead(notification.id);
                            }
                            setNotificationsOpen(false);
                            if (notification.complaint_id) {
                              navigate(`/officer/complaints/${notification.complaint_id}`);
                            }
                          }}
                          className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'} ${!notification.is_read ? (isDark ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{notification.title}</p>
                              <p className={`text-xs mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{notification.message}</p>
                              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{getTimeAgo(notification.created_at)}</p>
                            </div>
                            {!notification.is_read && <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-lg transition-all duration-200 ${iconButtonClasses}`}
            title="Toggle Theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          <div className={`hidden sm:block h-8 ${dividerClasses}`} style={{ width: '1px' }}></div>

          <div className="relative">
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setNotificationsOpen(false);
              }}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${userMenuTriggerClasses}`}
            >
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {getUserInitials()}
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {user?.first_name || 'User'}
                </span>
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Member'}
                </span>
              </div>
              <svg
                className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'} transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div
                className={`absolute right-0 mt-3 w-56 rounded-xl shadow-xl py-2 z-50 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} backdrop-blur-sm`}
              >
                <div className={`px-5 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Account
                  </p>
                  <p className={`text-sm font-medium mt-1.5 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'} mt-1`}>
                    {user?.email}
                  </p>
                </div>
                <div className="py-2">
                  <Link
                    to={getDashboardPath()}
                    onClick={() => setDropdownOpen(false)}
                    className={`flex items-center px-5 py-2.5 text-sm font-medium transition-colors duration-150 ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                  >
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Profile Settings
                  </Link>
                </div>
                <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'} py-2`}>
                  <button
                    onClick={() => {
                      handleLogout();
                      setDropdownOpen(false);
                    }}
                    className={`flex items-center w-full px-5 py-2.5 text-sm font-medium transition-colors duration-150 ${isDark ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}`}
                  >
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default DashboardNavbar;
