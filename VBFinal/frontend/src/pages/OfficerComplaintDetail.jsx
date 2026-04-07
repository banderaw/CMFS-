import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import ComplaintConversation from '../components/complaints/ComplaintConversation';
import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { OFFICER_NAV_ITEMS } from '../constants/navigation';
import apiService from '../services/api';

const getFileIcon = (contentType = '', filename = '') => {
  const ext = filename.toLowerCase();
  const type = contentType.toLowerCase();

  if (type.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(ext)) return 'IMG';
  if (type.includes('pdf') || ext.endsWith('.pdf')) return 'PDF';
  if (type.includes('word') || type.includes('document') || /\.(doc|docx|txt)$/.test(ext)) return 'DOC';
  if (type.includes('excel') || type.includes('sheet') || /\.(xls|xlsx|csv)$/.test(ext)) return 'XLS';
  return 'FILE';
};

const OfficerComplaintDetail = () => {
  const navigate = useNavigate();
  const { complaintId } = useParams();
  const { logout } = useAuth();
  const { isDark } = useTheme();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStatus, setNewStatus] = useState('pending');
  const [officers, setOfficers] = useState([]);
  const [reassignOfficerId, setReassignOfficerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [showReassign, setShowReassign] = useState(false);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const loadComplaint = useCallback(async () => {
    if (!complaintId) return;
    setLoading(true);
    try {
      const data = await apiService.getComplaint(complaintId);
      setComplaint(data);
      setNewStatus(data?.status || 'pending');
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
      file_size: attachment.file_size,
      content_type: attachment.content_type || '',
      uploaded_at: attachment.uploaded_at || complaint.created_at,
    })).filter((file) => Boolean(file.url));
  }, [complaint]);

  const handleUpdateStatus = async () => {
    if (!complaint) return;
    try {
      await apiService.changeComplaintStatus(complaint.complaint_id, newStatus);
      await loadComplaint();
      window.alert('Status updated successfully');
    } catch (err) {
      window.alert(err.message || 'Failed to update status');
    }
  };

  const loadOfficers = async () => {
    if (!complaintId) return;
    setLoadingOfficers(true);
    try {
      const usersData = await apiService.getComplaintEligibleOfficers(complaintId);
      const availableOfficers = Array.isArray(usersData?.results)
        ? usersData.results
        : Array.isArray(usersData)
          ? usersData
          : [];

      setOfficers(availableOfficers);

      const currentAssignee = availableOfficers.find((officer) => officer.is_current_assignee);
      if (currentAssignee) {
        setReassignOfficerId(String(currentAssignee.id));
      } else if (availableOfficers.length > 0) {
        setReassignOfficerId(String(availableOfficers[0].id));
      } else {
        setReassignOfficerId('');
      }
    } catch {
      setOfficers([]);
      setReassignOfficerId('');
      window.alert('Unable to load officers available for this complaint.');
    } finally {
      setLoadingOfficers(false);
    }
  };

  const handleToggleReassign = async () => {
    if (!showReassign) {
      await loadOfficers();
    }
    setShowReassign((prev) => !prev);
  };

  const handleReassign = async () => {
    if (!complaint || !reassignOfficerId) {
      window.alert('Please select an officer');
      return;
    }

    try {
      await apiService.reassignComplaint(complaint.complaint_id, {
        officer_id: Number(reassignOfficerId),
        reason: reassignReason || 'Reassigned by officer',
      });
      setShowReassign(false);
      setReassignOfficerId('');
      setReassignReason('');
      await loadComplaint();
      window.alert('Complaint reassigned successfully');
    } catch (err) {
      window.alert(err.message || 'Failed to reassign complaint');
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
          items={OFFICER_NAV_ITEMS}
          activeItem="complaints"
          onItemClick={(id) => {
            navigate(`/officer?tab=${id}`);
            setSidebarOpen(false);
          }}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => {
            navigate('/officer?tab=profile');
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
          <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate(-1)} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
                Back
              </button>
              <button onClick={loadComplaint} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">
                Refresh
              </button>
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

            <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button onClick={handleUpdateStatus} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
                  Update Status
                </button>
                <button onClick={handleToggleReassign} className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700">
                  {showReassign ? 'Cancel Reassign' : 'Reassign'}
                </button>
              </div>

              {showReassign && (
                <div className="grid md:grid-cols-2 gap-3 pt-2">
                  <select
                    value={reassignOfficerId}
                    onChange={(e) => setReassignOfficerId(e.target.value)}
                    disabled={loadingOfficers || officers.length === 0}
                    className="px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="">{loadingOfficers ? 'Loading officers...' : 'Select officer'}</option>
                    {officers.map((officer) => (
                      <option key={officer.id} value={officer.id}>
                        {(officer.full_name || '').trim() || ((officer.first_name || '') + ' ' + (officer.last_name || '')).trim() || officer.email}
                        {officer.is_current_assignee ? ' (Current)' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="px-3 py-2 border border-gray-300 rounded"
                  />
                  <button onClick={handleReassign} className="md:col-span-2 px-4 py-2 rounded bg-orange-600 text-white hover:bg-orange-700">
                    Confirm Reassign
                  </button>
                  {!loadingOfficers && officers.length === 0 && (
                    <p className="md:col-span-2 text-sm text-red-600">
                      No eligible officers found for this complaint category.
                    </p>
                  )}
                </div>
              )}
            </section>

            {attachments.length > 0 && (
              <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                <h3 className="text-lg font-semibold">Attachments</h3>
                <div className="space-y-2">
                  {attachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded border border-gray-200 hover:bg-gray-50"
                    >
                      <span className="text-sm text-gray-700">{getFileIcon(file.content_type, file.filename)} - {file.filename}</span>
                      <span className="text-xs text-gray-500">Open</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            <ComplaintConversation complaint={complaint} role="officer" />
          </div>
        </main>
      </div>
    </div>
  );
};

export default OfficerComplaintDetail;
