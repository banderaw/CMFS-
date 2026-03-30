import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import InstitutionManagement from '../components/Admin/InstitutionManagement';
import UserManagement from '../components/Admin/UserManagement';
import SystemManagement from '../components/Admin/SystemManagement';
import FeedbackTemplateManagement from '../components/Admin/FeedbackTemplateManagement';
import AdminComplaints from '../components/Admin/AdminComplaints';
import ContactManagement from '../components/Admin/ContactManagement';
import AdminProfile from '../components/Admin/AdminProfile';

const AdminDashboard = ({ initialTab = 'overview' }) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [institutions, setInstitutions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    urgent: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    loadSystemStats();
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadSystemStats = async () => {
    try {
      const [complaintsData, usersData, institutionsData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getAllUsers(),
        apiService.getInstitutions()
      ]);

      const complaints = complaintsData.results || complaintsData;
      const users = usersData.results || usersData;
      const institutions = institutionsData.results || institutionsData;

      // Calculate resolution time
      const resolvedComplaints = complaints.filter(c => c.status === 'resolved');
      let avgResolutionDays = 0;
      if (resolvedComplaints.length > 0) {
        const totalDays = resolvedComplaints.reduce((sum, complaint) => {
          const created = new Date(complaint.created_at);
          const updated = new Date(complaint.updated_at);
          const diffDays = Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
          return sum + diffDays;
        }, 0);
        avgResolutionDays = Math.round(totalDays / resolvedComplaints.length);
      }

      setSystemStats({
        totalComplaints: complaints.length,
        pendingComplaints: complaints.filter(c => c.status === 'pending').length,
        resolvedComplaints: complaints.filter(c => c.status === 'resolved').length,
        urgentComplaints: complaints.filter(c => c.priority === 'urgent').length,
        totalUsers: users.length,
        totalInstitutions: institutions.length,
        avgResolutionTime: `${avgResolutionDays} days`
      });
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [institutionsData, categoriesData, statsData] = await Promise.all([
        apiService.getInstitutions(),
        apiService.getCategories(),
        apiService.getDashboardStats()
      ]);
      
      setInstitutions(institutionsData);
      setCategories(categoriesData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { id: 'overview', name: 'Dashboard', icon: '📊' },
    { id: 'complaints', name: 'Complaints', icon: '📝' },
    { id: 'institutions', name: 'Institutions', icon: '🏛️' },
    { id: 'users', name: 'Users', icon: '👤' },
    { id: 'feedback-templates', name: 'Feedback Templates', icon: '📋' },
    { id: 'contact', name: 'Contact', icon: '✉️' },
    { id: 'system', name: 'System', icon: '⚙️' },
    { id: 'profile', name: 'Profile', icon: '👤' }
  ];

  const [systemStats, setSystemStats] = useState({
    totalComplaints: 0,
    pendingComplaints: 0,
    resolvedComplaints: 0,
    urgentComplaints: 0,
    totalUsers: 0,
    totalInstitutions: 0,
    avgResolutionTime: '0 days'
  });

  const renderOverview = () => {
    return (
      <div className="space-y-6">
        {/* System Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">📝</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Complaints</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.totalComplaints}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">⏳</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pending</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.pendingComplaints}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">✅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Resolved</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.resolvedComplaints}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">🚨</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Urgent</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.urgentComplaints}</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">👥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Users</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">🏛️</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Institutions</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.totalInstitutions}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Recent Activity
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {systemStats.resolvedComplaints} complaints resolved this month
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {systemStats.totalUsers} active users in system
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {systemStats.pendingComplaints} complaints awaiting review
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {systemStats.urgentComplaints} urgent complaints require attention
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'complaints':
        return <AdminComplaints />;
      case 'institutions':
        return <InstitutionManagement />;
      case 'users':
        return <UserManagement />;
      case 'feedback-templates':
        return <FeedbackTemplateManagement />;
      case 'contact':
        return <ContactManagement />;
      case 'system':
        return <SystemManagement />;
      case 'profile':
        return <AdminProfile />;
      default:
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-neutral">{menuItems.find(t => t.id === activeTab)?.name}</h3>
            <p className="text-neutral mt-2">Content for {activeTab} will be implemented here.</p>
          </div>
        );
    }
  };

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
          showBottomSection={false}
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
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</div>
                </div>
              </div>
            ) : (
              renderTabContent()
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
