import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { FeedbackFormBuilder, FeedbackAnalytics } from '../components/feedback';
import MaintenanceNotification from '../components/UI/MaintenanceNotification';
import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import apiService from '../services/api';
import OfficerSchedule from '../components/Officer/OfficerSchedule';
import OfficerProfile from '../components/Officer/OfficerProfile';
import PublicAnnouncementBoard from '../components/Officer/PublicAnnouncementBoard';
import Modal from '../components/UI/Modal';
import ComplaintConversation from '../components/complaints/ComplaintConversation';
import ComplaintAnalyticsPanel from '../components/analytics/ComplaintAnalyticsPanel';
import { OFFICER_NAV_ITEMS } from '../constants/navigation';

const OfficerDashboard = () => {
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('all');
  const [templateStatusFilter, setTemplateStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [ccComplaints, setCcComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [responses, setResponses] = useState([]);
  const [comments, setComments] = useState([]);
  const [threadSyncing, setThreadSyncing] = useState(false);
  const [hasThreadUpdates, setHasThreadUpdates] = useState(false);
  const threadSnapshotRef = useRef('');
  const latestResponseRef = useRef(null);
  const latestCommentRef = useRef(null);
  const [dashboardStats, setDashboardStats] = useState({
    assignedComplaints: 0,
    resolvedComplaints: 0,
    pendingComplaints: 0,
    totalTemplates: 0
  });
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignOfficerId, setReassignOfficerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [officers, setOfficers] = useState([]);

  const menuItems = OFFICER_NAV_ITEMS;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && menuItems.some((item) => item.id === tab)) {
      setActiveTab(tab);
    }
  }, [location.search, menuItems]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const complaintsData = await apiService.getComplaints();
      const allComplaints = complaintsData.results || complaintsData || [];

      const assignedComplaints = allComplaints.filter(c => c.assigned_officer?.id === user?.id).length;
      const resolvedComplaints = allComplaints.filter(c => c.assigned_officer?.id === user?.id && c.status === 'resolved').length;
      const pendingComplaints = allComplaints.filter(c => c.assigned_officer?.id === user?.id && c.status === 'pending').length;

      setDashboardStats({
        assignedComplaints,
        resolvedComplaints,
        pendingComplaints,
        totalTemplates: 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  }, [user?.id]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiService.getFeedbackTemplates();
      setTemplates(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };



  const fetchComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const data = await apiService.getComplaints();
      const availableComplaints = Array.isArray(data) ? data : data.results || [];
      setComplaints(availableComplaints);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setComplaints([]);
    } finally {
      setComplaintsLoading(false);
    }
  }, []);

  const fetchCCComplaints = async () => {
    try {
      const data = await apiService.getCCComplaints();
      setCcComplaints(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Error fetching CC complaints:', error);
      setCcComplaints([]);
    }
  };

  const fetchOfficers = async () => {
    try {
      const usersData = await apiService.getAllUsers();
      const allUsers = Array.isArray(usersData?.results)
        ? usersData.results
        : Array.isArray(usersData)
          ? usersData
          : [];

      const officerUsers = allUsers.filter((u) => {
        const role = (u.role || '').toString().toLowerCase();
        return role === 'officer' || role.includes('officer') || u.is_staff === true;
      });

      setOfficers(officerUsers.length > 0 ? officerUsers : allUsers);
    } catch (error) {
      console.error('Error fetching officers:', error);
      setOfficers([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'manage-templates') {
      fetchTemplates();
    }
    if (activeTab === 'complaints') {
      fetchComplaints();
      fetchCCComplaints();
    }
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
      fetchTemplates();
    }
  }, [activeTab, user?.id, fetchComplaints, fetchDashboardStats]);

  useEffect(() => {
    setDashboardStats((prev) => ({
      ...prev,
      totalTemplates: Array.isArray(templates) ? templates.length : 0,
    }));
  }, [templates]);

  const handleReassign = async () => {
    if (!reassignOfficerId) {
      alert('Please select an officer to reassign to');
      return;
    }

    try {
      await apiService.reassignComplaint(selectedComplaint.complaint_id, {
        officer_id: reassignOfficerId,
        reason: reassignReason || 'Reassigned by officer'
      });
      alert('Complaint reassigned successfully');
      setShowReassignModal(false);
      setReassignOfficerId('');
      setReassignReason('');
      fetchComplaints();
    } catch (error) {
      console.error('Error reassigning complaint:', error);
      alert(error.message || 'Failed to reassign complaint');
    }
  };

  const handleUpdateStatus = async () => {
    try {
      await apiService.changeComplaintStatus(selectedComplaint.complaint_id, newStatus);
      fetchComplaints();
      setNewStatus('');
      alert('Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const fetchResponses = useCallback(async (complaintId = null) => {
    const targetComplaintId = complaintId || selectedComplaint?.complaint_id;
    if (!targetComplaintId) return [];
    try {
      const data = await apiService.getComplaintResponses(targetComplaintId);
      const responseList = data.results || data || [];
      setResponses(responseList);
      return responseList;
    } catch (error) {
      console.error('Error fetching responses:', error);
      setResponses([]);
      return [];
    }
  }, [selectedComplaint?.complaint_id]);

  const fetchComments = useCallback(async (complaintId = null) => {
    const targetComplaintId = complaintId || selectedComplaint?.complaint_id;
    if (!targetComplaintId) return [];
    try {
      const data = await apiService.getComplaintComments(targetComplaintId);
      const commentList = data.results || data || [];
      setComments(commentList);
      return commentList;
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
      return [];
    }
  }, [selectedComplaint?.complaint_id]);

  const syncSelectedComplaintThread = useCallback(async (silent = false, complaintIdOverride = null) => {
    const complaintId = complaintIdOverride || selectedComplaint?.complaint_id;
    if (!complaintId) return;

    if (!silent) setThreadSyncing(true);
    try {
      const latestComplaint = await apiService.getComplaint(complaintId);
      if (latestComplaint?.complaint_id) {
        setSelectedComplaint(latestComplaint);
      }

      const [nextResponses, nextComments] = await Promise.all([
        fetchResponses(complaintId),
        fetchComments(complaintId),
      ]);

      const nextSignature = [
        nextResponses.length,
        nextResponses[0]?.id || '',
        nextResponses[0]?.updated_at || nextResponses[0]?.created_at || '',
        nextComments.length,
        nextComments[0]?.id || '',
        nextComments[0]?.updated_at || nextComments[0]?.created_at || '',
      ].join('|');

      if (silent && threadSnapshotRef.current && threadSnapshotRef.current !== nextSignature) {
        setHasThreadUpdates(true);
      }

      threadSnapshotRef.current = nextSignature;

      if (!silent) {
        setHasThreadUpdates(false);
      }
    } catch (error) {
      console.error('Error syncing complaint thread:', error);
    } finally {
      if (!silent) setThreadSyncing(false);
    }
  }, [selectedComplaint?.complaint_id, fetchResponses, fetchComments]);

  useEffect(() => {
    if (!showComplaintModal || !selectedComplaint?.complaint_id) return;

    const interval = setInterval(() => {
      syncSelectedComplaintThread(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [showComplaintModal, selectedComplaint?.complaint_id, syncSelectedComplaintThread]);

  const scrollToNewestThreadItem = useCallback(() => {
    const newestResponseTime = responses[0]?.updated_at || responses[0]?.created_at || null;
    const newestCommentTime = comments[0]?.updated_at || comments[0]?.created_at || null;

    const responseTs = newestResponseTime ? Date.parse(newestResponseTime) : 0;
    const commentTs = newestCommentTime ? Date.parse(newestCommentTime) : 0;

    const targetRef = commentTs > responseTs ? latestCommentRef : latestResponseRef;
    if (targetRef.current && typeof targetRef.current.scrollIntoView === 'function') {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHasThreadUpdates(false);
    }
  }, [responses, comments]);

  const handleStatusChange = async (templateId, newStatus) => {
    try {
      if (newStatus === 'active') {
        await apiService.activateFeedbackTemplate(templateId);
      } else if (newStatus === 'closed') {
        await apiService.closeFeedbackTemplate(templateId);
      } else {
        await apiService.deactivateFeedbackTemplate(templateId);
      }
      fetchTemplates();
      alert('Template updated successfully!');
    } catch (error) {
      console.error('Error updating template status:', error);
      alert('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await apiService.deleteFeedbackTemplate(templateId);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const exportResults = async (templateId, format = 'csv') => {
    try {
      const data = await apiService.getFeedbackTemplateAnalytics(templateId);

      if (format === 'csv') {
        const csv = convertToCSV(data);
        downloadFile(csv, `feedback-${templateId}.csv`, 'text/csv');
      } else {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `feedback-${templateId}.json`, 'application/json');
      }
    } catch (error) {
      console.error('Error exporting results:', error);
    }
  };

  const convertToCSV = (data) => {
    const headers = ['Field', 'Type', 'Average/Count', 'Details'];
    const rows = Object.entries(data.field_analytics).map(([field, analytics]) => [
      field,
      analytics.type,
      analytics.average || analytics.count || 0,
      JSON.stringify(analytics.choices || analytics)
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadFile = (content, filename, contentType) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredTemplates = Array.isArray(templates) ? templates.filter(template =>
    templateStatusFilter === 'all' || template.status === templateStatusFilter
  ).reverse() : [];

  const getComplaintFiles = (complaint) => {
    if (!complaint) return [];

    const files = [];
    const attachments = Array.isArray(complaint.attachments) ? complaint.attachments : [];

    attachments.forEach((attachment, index) => {
      const attachmentUrl = attachment?.download_url || attachment?.file;
      if (!attachmentUrl) return;
      files.push({
        id: attachment.id || `attachment-${index}`,
        url: attachmentUrl,
        filename: attachment.filename || `Attachment ${index + 1}`,
        file_size: attachment.file_size,
        content_type: attachment.content_type || '',
        uploaded_at: attachment.uploaded_at,
      });
    });

    // Backward compatibility for old payloads that only have the single attachment field
    if (complaint.attachment && !files.some((file) => file.url === complaint.attachment)) {
      const fallbackName = complaint.attachment.split('/').pop() || 'Attachment';
      files.push({
        id: 'legacy-attachment',
        url: complaint.attachment,
        filename: fallbackName,
        file_size: null,
        content_type: '',
        uploaded_at: complaint.created_at,
      });
    }

    return files;
  };

  const getFileIcon = (contentType = '', filename = '') => {
    const ext = filename.toLowerCase();
    const type = contentType.toLowerCase();

    if (type.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(ext)) return '🖼️';
    if (type.includes('pdf') || ext.endsWith('.pdf')) return '📄';
    if (type.includes('word') || type.includes('document') || /\.(doc|docx|txt)$/.test(ext)) return '📝';
    if (type.includes('excel') || type.includes('sheet') || /\.(xls|xlsx|csv)$/.test(ext)) return '📊';
    if (type.includes('presentation') || /\.(ppt|pptx)$/.test(ext)) return '📈';
    return '📎';
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Officer Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-800">Assigned Complaints</h3>
                  <p className="text-3xl font-bold text-blue-600">{dashboardStats.assignedComplaints}</p>
                  <p className="text-sm text-blue-600">Total assigned</p>
                </div>
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-yellow-800">Pending</h3>
                  <p className="text-3xl font-bold text-yellow-600">{dashboardStats.pendingComplaints}</p>
                  <p className="text-sm text-yellow-600">Awaiting action</p>
                </div>
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-800">Resolved</h3>
                  <p className="text-3xl font-bold text-green-600">{dashboardStats.resolvedComplaints}</p>
                  <p className="text-sm text-green-600">Successfully resolved</p>
                </div>
                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-purple-800">Templates</h3>
                  <p className="text-3xl font-bold text-purple-600">{dashboardStats.totalTemplates}</p>
                  <p className="text-sm text-purple-600">Feedback templates</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">Recent Complaints</h3>
                {complaints.filter(c => c.assigned_officer?.id === user?.id).slice(0, 5).length > 0 ? (
                  <div className="space-y-3">
                    {complaints.filter(c => c.assigned_officer?.id === user?.id).slice(0, 5).map((complaint) => (
                      <div key={complaint.complaint_id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-sm">{complaint.title}</h4>
                            <p className="text-xs text-gray-600">{complaint.category?.office_name || complaint.category?.name || 'Uncategorized'}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${complaint.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              complaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                            {complaint.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <p className="mb-4">No assigned complaints</p>
                  </div>
                )}
                <div className="mt-4">
                  <button
                    onClick={() => setActiveTab('complaints')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Manage All Complaints
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">Recent Templates</h3>
                {loading ? (
                  <div className="text-center py-8 text-gray-600">Loading...</div>
                ) : !Array.isArray(templates) || templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <p className="mb-4">No templates created yet</p>
                    <button
                      onClick={() => setActiveTab('create-template')}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Create Template
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates.slice().reverse().slice(0, 5).map(template => (
                      <div key={template.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <h4 className="font-medium text-sm">{template.title}</h4>
                          <p className="text-xs text-gray-600">
                            Created: {new Date(template.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${template.status === 'active' ? 'bg-green-100 text-green-800' :
                          template.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                            'bg-red-100 text-red-800'
                          }`}>
                          {template.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <button
                    onClick={() => setActiveTab('manage-templates')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    Manage All Templates
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'complaints':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Complaints</h2>
            <div className="bg-white rounded-lg shadow p-6">
              {complaintsLoading ? (
                <div className="text-center py-8 text-gray-600">Loading complaints...</div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-xl mb-2">No Complaints Assigned</p>
                  <p>You don't have any complaints assigned to you yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Assigned Complaints ({complaints.length})</h3>
                    <select
                      value={complaintStatusFilter}
                      onChange={(e) => setComplaintStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="escalated">Escalated</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    {complaints
                      .filter(complaint => complaintStatusFilter === 'all' || complaint.status === complaintStatusFilter)
                      .map(complaint => (
                        <div key={complaint.complaint_id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-lg">{complaint.title}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${complaint.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                complaint.status === 'escalated' ? 'bg-red-100 text-red-800' :
                                  complaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                              }`}>
                              {complaint.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>

                          <p className="text-gray-600 mb-3">{complaint.description}</p>

                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <div className="space-x-4">
                              <span>ID: {complaint.complaint_id.slice(0, 8)}...</span>
                              <span>Category: {complaint.category?.office_name || complaint.category?.name || 'Uncategorized'}</span>
                            </div>
                            <span>Created: {new Date(complaint.created_at).toLocaleDateString()}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 items-center">
                            {getComplaintFiles(complaint).length > 0 && (
                              <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-800 flex items-center gap-1">
                                📎 {getComplaintFiles(complaint).length} file{getComplaintFiles(complaint).length > 1 ? 's' : ''}
                              </span>
                            )}
                            <button
                              onClick={() => {
                                navigate(`/officer/complaints/${complaint.complaint_id}`);
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              View & Manage
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* CC'd Complaints Section */}
              {ccComplaints.length > 0 && (
                <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className={`text-lg font-semibold text-purple-600 flex items-center gap-2`}>
                      📋 CC'd Complaints ({ccComplaints.length})
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {ccComplaints
                      .filter(complaint => complaintStatusFilter === 'all' || complaint.status === complaintStatusFilter)
                      .map(complaint => (
                        <div
                          key={complaint.complaint_id}
                          className={`border-l-4 border-purple-500 rounded-lg p-4 ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'} transition-colors`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-purple-600 text-lg">🔗</span>
                              <h4 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{complaint.title}</h4>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${complaint.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                complaint.status === 'escalated' ? 'bg-red-100 text-red-800' :
                                  complaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                              }`}>
                              {complaint.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>

                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-3`}>
                            {complaint.description.length > 100
                              ? `${complaint.description.substring(0, 100)}...`
                              : complaint.description}
                          </p>

                          <div className={`flex justify-between items-center text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <div className="space-x-4">
                              <span>ID: {complaint.complaint_id.slice(0, 8)}</span>
                              <span>Category: {complaint.category?.office_name || 'Uncategorized'}</span>
                            </div>
                            <span>Created: {new Date(complaint.created_at).toLocaleDateString()}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 items-center">
                            {getComplaintFiles(complaint).length > 0 && (
                              <span className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}`}>
                                📎 {getComplaintFiles(complaint).length} file{getComplaintFiles(complaint).length > 1 ? 's' : ''}
                              </span>
                            )}
                            <button
                              onClick={() => {
                                navigate(`/officer/complaints/${complaint.complaint_id}`);
                              }}
                              className={`px-4 py-2 rounded text-white font-medium ${isDark ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'} transition-colors`}
                            >
                              View & Monitor
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 'create-template':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Feedback Template</h2>

            {/* Only Feedback Template is supported */}
            <FeedbackFormBuilder onSave={() => {
              setActiveTab('manage-templates');
              fetchTemplates();
            }} />
          </div>
        );

      case 'manage-templates':
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Manage Templates</h2>
              <select
                value={templateStatusFilter}
                onChange={(e) => setTemplateStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Templates</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="closed">Closed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-600">Loading templates...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                No templates found for the selected status.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTemplates.map(template => (
                  <div key={template.id} className="bg-white rounded-lg shadow p-6 border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">{template.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${template.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                        template.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          template.status === 'active' ? 'bg-green-100 text-green-800' :
                            template.status === 'inactive' ? 'bg-slate-100 text-slate-700' :
                              template.status === 'closed' ? 'bg-red-100 text-red-800' :
                                'bg-rose-100 text-rose-800'
                        }`}>
                        {template.status}
                      </span>
                    </div>

                    {template.description && (
                      <p className="text-gray-600 mb-4">{template.description}</p>
                    )}

                    <div className="text-sm text-gray-500 mb-4">
                      <p>Created: {new Date(template.created_at).toLocaleDateString()}</p>
                      <p>Fields: {template.fields?.length || 0}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedTemplate(template.id);
                          setActiveTab('analytics');
                        }}
                        className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                      >
                        View Analytics
                      </button>

                      {(template.status === 'draft' || template.status === 'pending' || template.status === 'inactive') && (
                        <button
                          onClick={() => handleStatusChange(template.id, 'active')}
                          className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Activate
                        </button>
                      )}

                      {template.status === 'active' && (
                        <button
                          onClick={() => handleStatusChange(template.id, 'closed')}
                          className="px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                        >
                          Close
                        </button>
                      )}

                      <button
                        onClick={() => exportResults(template.id, 'csv')}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Export CSV
                      </button>

                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'analytics':
        return (
          <div>
            <div className="mb-6">
              <ComplaintAnalyticsPanel
                title="Assigned Complaint Analytics"
                subtitle="Live updates for the complaints currently assigned to you."
                accent="emerald"
              />
            </div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
              {selectedTemplate && (
                <div className="flex gap-2">
                  <button
                    onClick={() => exportResults(selectedTemplate, 'csv')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => exportResults(selectedTemplate, 'json')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Export JSON
                  </button>
                </div>
              )}
            </div>

            {selectedTemplate ? (
              <FeedbackAnalytics templateId={selectedTemplate} />
            ) : (
              <div className="text-center py-16 text-gray-600">
                <p className="text-lg mb-4">Select a template to view analytics</p>
                <button
                  onClick={() => setActiveTab('manage-templates')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Go to Templates
                </button>
              </div>
            )}
          </div>
        );

      case 'schedule':
        return <OfficerSchedule />;

      case 'announcements':
        return <PublicAnnouncementBoard />;

      case 'profile':
        return <OfficerProfile />;

      default:
        return <div>Page not found</div>;
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

            <Modal
              isOpen={showComplaintModal}
              onClose={() => {
                setShowComplaintModal(false);
                setSelectedComplaint(null);
                setResponses([]);
                setComments([]);
                setShowReassignModal(false);
              }}
              title={selectedComplaint ? `Manage Complaint: ${selectedComplaint.title}` : 'Manage Complaint'}
              size="xl"
            >
              {selectedComplaint && (
                <div className="space-y-5">
                  <div className="flex justify-end">
                    {hasThreadUpdates && (
                      <button
                        type="button"
                        onClick={scrollToNewestThreadItem}
                        className="mr-2 px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                      >
                        New updates
                      </button>
                    )}
                    <button
                      onClick={() => syncSelectedComplaintThread(false)}
                      disabled={threadSyncing}
                      className={`px-3 py-1 rounded text-sm transition-colors ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {threadSyncing ? 'Syncing...' : 'Sync'}
                    </button>
                  </div>

                  <div className={`p-4 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedComplaint.description}</p>
                  </div>

                  {/* CC Information */}
                  {selectedComplaint.is_cc_user && (
                    <div className={`p-3 rounded-lg border-l-4 border-blue-500 ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                      <p className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                        ⭐ You are CC'd on this complaint
                      </p>
                    </div>
                  )}

                  {selectedComplaint.cc_list && selectedComplaint.cc_list.length > 0 && (
                    <div className={`p-4 rounded-lg border-l-4 border-purple-500 ${isDark ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-200'}`}>
                      <h4 className={`font-semibold mb-2 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                        CC'd Officers ({selectedComplaint.cc_list.length})
                      </h4>
                      <div className="space-y-1">
                        {selectedComplaint.cc_list.map((cc, index) => (
                          <p key={index} className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            📧 {cc.email}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {getComplaintFiles(selectedComplaint).length > 0 && (
                    <div className={`p-4 rounded-lg border-l-4 border-green-500 ${isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'}`}>
                      <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                        📎 Attachments ({getComplaintFiles(selectedComplaint).length})
                      </h4>
                      <div className="space-y-2">
                        {getComplaintFiles(selectedComplaint).map((file) => (
                          <div
                            key={file.id}
                            className={`flex items-center justify-between p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} hover:shadow-sm transition-shadow`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-lg flex-shrink-0">{getFileIcon(file.content_type, file.filename)}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                  {file.filename}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                                  {' • '}
                                  {new Date(file.uploaded_at || selectedComplaint.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <a
                              href={file.url}
                              download={file.filename}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`ml-2 flex-shrink-0 px-3 py-2 rounded text-sm font-medium transition-colors ${isDark ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                                }`}
                            >
                              View
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</label>
                      <div className="flex gap-2">
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className={`flex-1 px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="escalated">Escalated</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                        <button
                          onClick={handleUpdateStatus}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Update
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Reassign</label>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await fetchOfficers();
                            setShowReassignModal((prev) => !prev);
                          }}
                          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                        >
                          {showReassignModal ? 'Cancel Reassign' : 'Reassign'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {showReassignModal && (
                    <div className={`p-4 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          value={reassignOfficerId}
                          onChange={(e) => setReassignOfficerId(e.target.value)}
                          className={`px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        >
                          <option value="">Select officer</option>
                          {officers
                            .filter((officer) => officer.id !== user?.id)
                            .map((officer) => (
                              <option key={officer.id} value={officer.id}>
                                {(officer.first_name || '') + ' ' + (officer.last_name || '')} ({officer.email})
                              </option>
                            ))}
                        </select>
                        <input
                          type="text"
                          value={reassignReason}
                          onChange={(e) => setReassignReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className={`px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        />
                      </div>
                      <button
                        onClick={handleReassign}
                        className="mt-3 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                      >
                        Confirm Reassign
                      </button>
                    </div>
                  )}

                  <ComplaintConversation complaint={selectedComplaint} role={user?.role} />
                </div>
              )}
            </Modal>
          </div>
        </main>
      </div>
    </div>
  );
};

export default OfficerDashboard;
