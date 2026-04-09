import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import DashboardNavbar from '../../components/UI/DashboardNavbar';
import Sidebar from '../../components/UI/Sidebar';

const HelpdeskShell = ({ activeItem = 'sessions', children }) => {
  const { isDark } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const menuItems = useMemo(
    () => [
      { id: 'sessions', name: 'All Sessions', icon: '🎧' },
      { id: 'new', name: 'New Session', icon: '➕' },
      { id: 'dashboard', name: 'Back To Dashboard', icon: '🏠' },
    ],
    []
  );

  const handleSidebarToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarCollapsed((prev) => !prev);
      return;
    }
    setSidebarOpen((prev) => !prev);
  };

  const handleItemClick = (id) => {
    if (id === 'sessions') {
      navigate('/helpdesk');
    } else if (id === 'new') {
      navigate('/helpdesk/new');
    } else {
      navigate('/');
    }
    setSidebarOpen(false);
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <DashboardNavbar onSidebarToggle={handleSidebarToggle} />

      <div className="flex pt-20">
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isDesktopSidebarCollapsed}
          items={menuItems}
          activeItem={activeItem}
          onItemClick={handleItemClick}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => { }}
          onHideSidebar={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
          showBottomSection={true}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20 top-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className={`flex-1 ${isDesktopSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default HelpdeskShell;
