import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import SubmitComplaint from '../components/User/SubmitComplaint';
import MyComplaints from '../components/User/MyComplaints';
import Notifications from '../components/User/Notifications';
import UserProfile from '../components/User/UserProfile';
import MaintenanceNotification from '../components/UI/MaintenanceNotification';
import UserFeedback from '../components/User/UserFeedback';
import Appointments from '../components/User/Appointments';

const UserDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { language, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('submit');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all'
  });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(3);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
    { id: 'submit', icon: '📝', name: t('submit_complaint') },
    { id: 'my-complaints', icon: '📋', name: t('my_complaints') },
    { id: 'appointments', icon: '📅', name: t('appointments') },
    { id: 'notifications', icon: '🔔', name: t('notifications'), badge: unreadCount },
    { id: 'feedback', icon: '💬', name: t('feedback') },
    { id: 'profile', icon: '👤', name: t('profile') }
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

  const handleSidebarToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarCollapsed((prev) => !prev);
      return;
    }
    setSidebarOpen((prev) => !prev);
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <DashboardNavbar onSidebarToggle={handleSidebarToggle} />
      
      <div className="flex pt-20">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isDesktopSidebarCollapsed}
          items={menuItems}
          activeItem={activeTab}
          onItemClick={(id) => {
            setActiveTab(id);
            setSidebarOpen(false);
          }}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => {
            setActiveTab('profile');
            setSidebarOpen(false);
          }}
          onHideSidebar={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
        />

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20 top-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className={`flex-1 ${isDesktopSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <MaintenanceNotification />
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
