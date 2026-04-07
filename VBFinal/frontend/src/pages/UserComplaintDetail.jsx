import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import ComplaintConversation from '../components/complaints/ComplaintConversation';
import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { getUserNavItems } from '../constants/navigation';
import apiService from '../services/api';

const UserComplaintDetail = () => {
  const navigate = useNavigate();
  const { complaintId } = useParams();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [unreadCount] = useState(0);

  const menuItems = getUserNavItems(t, unreadCount);

  const loadComplaint = useCallback(async () => {
    if (!complaintId) return;
    setLoading(true);
    try {
      const data = await apiService.getComplaint(complaintId);
      setComplaint(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load complaint details');
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    loadComplaint();
  }, [loadComplaint]);

  const attachments = useMemo(() => {
    if (!complaint) return [];
    const items = Array.isArray(complaint.attachments) ? complaint.attachments : [];
    return items.map((attachment, index) => ({
      id: attachment.id || `attachment-${index}`,
      url: attachment.download_url || attachment.file,
      filename: attachment.filename || `Attachment ${index + 1}`,
    })).filter((file) => Boolean(file.url));
  }, [complaint]);

  const handleDeleteComplaint = async () => {
    if (!complaint) return;
    if (!(complaint.status === 'pending' || complaint.status === 'draft')) {
      window.alert('Only pending complaints can be deleted.');
      return;
    }
    if (!window.confirm('Delete this complaint? This cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteComplaint(complaint.complaint_id);
      navigate(-1);
    } catch (err) {
      window.alert(err.message || 'Failed to delete complaint');
    }
  };

  if (loading) {
    return <div className="p-6">Loading complaint details...</div>;
  }

  if (error || !complaint) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={() => navigate(-1)} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
          Back
        </button>
        <p className="text-red-600">{error || 'Complaint not found'}</p>
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
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isDesktopSidebarCollapsed}
          items={menuItems}
          activeItem="my-complaints"
          onItemClick={(id) => {
            navigate(`/user?tab=${id}`);
            setSidebarOpen(false);
          }}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => {
            navigate('/user?tab=profile');
            setSidebarOpen(false);
          }}
          onHideSidebar={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20 top-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className={`flex-1 ${isDesktopSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
          <div className="max-w-5xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate(-1)} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
                Back
              </button>
              <div className="flex items-center gap-2">
                <button onClick={loadComplaint} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">
                  Refresh
                </button>
                {(complaint.status === 'pending' || complaint.status === 'draft') && (
                  <button onClick={handleDeleteComplaint} className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700">
                    Delete
                  </button>
                )}
              </div>
            </div>

            <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h2 className="text-2xl font-semibold">{complaint.title}</h2>
              <p className="text-gray-700">{complaint.description}</p>
              <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
                <p>ID: {complaint.complaint_id}</p>
                <p>Status: {complaint.status}</p>
                <p>Category: {complaint.category?.office_name || complaint.category?.name || 'Uncategorized'}</p>
                <p>Created: {new Date(complaint.created_at).toLocaleString()}</p>
              </div>
            </section>

            {attachments.length > 0 && (
              <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
                <h3 className="text-lg font-semibold">Attachments</h3>
                {attachments.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded border border-gray-200 hover:bg-gray-50"
                  >
                    {file.filename}
                  </a>
                ))}
              </section>
            )}

            <ComplaintConversation complaint={complaint} role="user" />
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserComplaintDetail;
