import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import SubmitComplaint from '../components/User/SubmitComplaint';
import MyComplaints from '../components/User/MyComplaints';
import Notifications from '../components/User/Notifications';
import UserProfile from '../components/User/UserProfile';
import MaintenanceNotification from '../components/UI/MaintenanceNotification';
import UserFeedback from '../components/User/UserFeedback';
import Appointments from '../components/User/Appointments';
import LanguageToggle from '../components/UI/LanguageToggle';

const UserDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { language, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('submit');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNavbarDropdown, setShowNavbarDropdown] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all'
  });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(3);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [complaints, filters]);

  const loadData = async () => {
    try {
      const [complaintsData, institutionsData, categoriesData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getInstitutions(),
        apiService.getCategories()
      ]);
      
      setComplaints(complaintsData.results || complaintsData);
      setInstitutions(institutionsData.results || institutionsData);
      setCategories(categoriesData.results || categoriesData);
      
      setNotifications([
        { id: 1, type: 'success', message: t('complaint_assigned'), read: false },
        { id: 2, type: 'info', message: t('status_updated'), read: false },
        { id: 3, type: 'warning', message: t('new_comment'), read: true }
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = complaints;
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter(c => c.category?.category_id === filters.category);
    }
    if (filters.priority !== 'all') {
      filtered = filtered.filter(c => c.priority === filters.priority);
    }
    
    setFilteredComplaints(filtered);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      escalated: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return badges[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      low: 'bg-green-500 text-white',
      medium: 'bg-yellow-500 text-white',
      high: 'bg-orange-500 text-white',
      urgent: 'bg-red-500 text-white'
    };
    return badges[priority] || 'bg-gray-500 text-white';
  };

  const renderTabContent = () => {
    if (submitSuccess) {
      return (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg flex items-center">
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-3">
            <span className="text-white text-xs">✓</span>
          </div>
          <div>
            <h4 className="font-medium">{t('complaint_submitted')}</h4>
            <p className="text-sm text-green-600 dark:text-green-400">{t('complaint_submitted')}</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'submit':
        return <SubmitComplaint institutions={institutions} setSubmitSuccess={setSubmitSuccess} />;
      case 'my-complaints':
        return (
          <div className="max-w-4xl mx-auto">
            <MyComplaints 
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
            />
          </div>
        );
      case 'feedback':
        return (
          <div className="max-w-4xl mx-auto">
            <UserFeedback />
          </div>
        );
      case 'notifications':
        return (
          <div className="max-w-4xl mx-auto">
            <Notifications setUnreadCount={setUnreadCount} />
          </div>
        );
      case 'profile':
        return <UserProfile />;
      case 'appointments':
        return (
          <div className="max-w-4xl mx-auto">
            <Appointments />
          </div>
        );
      default:
        return <SubmitComplaint institutions={institutions} setSubmitSuccess={setSubmitSuccess} />;
    }
  };

  const menuItems = [
    { id: 'submit', icon: '📝', label: t('submit_complaint') },
    { id: 'my-complaints', icon: '📋', label: t('my_complaints') },
    { id: 'appointments', icon: '📅', label: 'Appointments' },
    { id: 'notifications', icon: '🔔', label: t('notifications'), badge: unreadCount },
    { id: 'feedback', icon: '💬', label: t('feedback') },
    { id: 'profile', icon: '👤', label: t('profile') }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark' : ''}`}>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo and Title */}
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
                >
                  <span className="sr-only">Open sidebar</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="flex items-center ml-4 lg:ml-0">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t('student_portal')}
                  </h1>
                </div>
              </div>

              {/* Right side controls */}
              <div className="flex items-center space-x-4">
                <LanguageToggle className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700" />
                
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                  title={isDark ? t('switch_light_mode') : t('switch_dark_mode')}
                >
                  {isDark ? '☀️' : '🌙'}
                </button>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowNavbarDropdown(!showNavbarDropdown)}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {getUserInitials()}
                    </div>
                    <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user?.first_name} {user?.last_name}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showNavbarDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          setActiveTab('profile');
                          setShowNavbarDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t('profile')}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Breadcrumb nav */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center space-x-1 h-9 text-sm">
            <button onClick={() => navigate('/')} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Home
            </button>
            <span className="text-gray-400 dark:text-gray-500">/</span>
            <span className="text-gray-500 dark:text-gray-400">Student Portal</span>
            <span className="text-gray-400 dark:text-gray-500">/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {menuItems.find(m => m.id === activeTab)?.label}
            </span>
          </nav>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
            <div className="flex flex-col h-full pt-16 lg:pt-0">
              <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                <nav className="mt-5 flex-1 px-2 space-y-1">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`${
                        activeTab === item.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-600 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left transition-colors`}
                    >
                      <span className="mr-3 text-lg">{item.icon}</span>
                      {item.label}
                      {item.badge && (
                        <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main content */}
          <div className="flex-1 lg:ml-0">
            <main className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <MaintenanceNotification />
                {renderTabContent()}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
