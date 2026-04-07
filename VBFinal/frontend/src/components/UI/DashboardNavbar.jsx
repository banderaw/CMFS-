import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const DashboardNavbar = ({ onSidebarToggle }) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout, getUserRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  return (
    <header className={`${isDark ? 'bg-gray-900/95 border-gray-700' : 'bg-white/95 border-gray-100'} backdrop-blur-md shadow-md border-b sticky top-0 left-0 right-0 z-50 w-full`}>
      <nav className="px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        {/* Left: Logo and Sidebar Toggle */}
        <div className="flex items-center space-x-6 min-w-0">
          <button
            onClick={onSidebarToggle}
            className={`p-2.5 rounded-lg transition-all duration-200 ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
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
              ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
              : isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >
            Dashboard
          </Link>
          <Link
            to="/landing"
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >
            Home
          </Link>
          <Link
            to="/landing#features"
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >
            Features
          </Link>
          <Link
            to="/landing#about"
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >
            About
          </Link>
          <Link
            to="/landing#contact"
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >
            Contact
          </Link>
        </div>

        {/* Right: Theme Toggle and User Menu */}
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-lg transition-all duration-200 ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            title="Toggle Theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          <div className={`hidden sm:block h-8 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ width: '1px' }}></div>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
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
