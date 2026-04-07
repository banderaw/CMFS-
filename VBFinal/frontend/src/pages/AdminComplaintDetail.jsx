import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const getStatusBadge = (status) => {
  const badges = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    escalated: 'bg-red-100 text-red-800',
  };
  return badges[status] || 'bg-gray-100 text-gray-800';
};

const AdminComplaintDetail = () => {
  const navigate = useNavigate();
  const { complaintId } = useParams();
  const { isDark } = useTheme();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [complaint, setComplaint] = useState(null);
  const [responses, setResponses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [newResponse, setNewResponse] = useState('');
  const [responseTitle, setResponseTitle] = useState('');
  const [responseType, setResponseType] = useState('update');

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignOfficerId, setReassignOfficerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [levels, setLevels] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const loadBaseData = useCallback(async () => {
    const [complaintData, categoriesData, officersData] = await Promise.all([
      apiService.getComplaint(complaintId),
      apiService.getAllCategories(),
      apiService.getAllUsers(),
    ]);

    setComplaint(complaintData);
    setCategories(categoriesData.results || categoriesData || []);

    const allUsers = officersData.results || officersData || [];
    const officerUsers = allUsers.filter((user) => user.role === 'officer' || user.is_staff);
    setOfficers(officerUsers);

    if (complaintData?.category?.category_id) {
      setSelectedCategory(complaintData.category.category_id);
    }
  }, [complaintId]);

  const loadResponses = useCallback(async () => {
    const data = await apiService.getComplaintResponses(complaintId);
    setResponses(data.results || data || []);
  }, [complaintId]);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadBaseData(), loadResponses()]);
    } catch (error) {
      console.error('Failed to load complaint details:', error);
      window.alert('Failed to load complaint details');
      navigate('/admin?tab=complaints');
    } finally {
      setLoading(false);
    }
  }, [loadBaseData, loadResponses, navigate]);

  useEffect(() => {
    if (!complaintId) {
      navigate('/admin?tab=complaints');
      return;
    }
    loadPageData();
  }, [complaintId, loadPageData, navigate]);

  const updateComplaintStatus = async (newStatus) => {
    if (!complaint) return;

    try {
      await apiService.updateComplaint(complaint.complaint_id, { status: newStatus });
      setComplaint((prev) => ({ ...prev, status: newStatus }));
    } catch (error) {
      console.error('Failed to update complaint status:', error);
      window.alert('Failed to update complaint status');
    }
  };

  const assignCategory = async (categoryId) => {
    if (!complaint) return;

    try {
      await apiService.updateComplaint(complaint.complaint_id, { category: categoryId || null });
      const updatedCategory = categoryId
        ? categories.find((cat) => String(cat.category_id) === String(categoryId))
        : null;
      setComplaint((prev) => ({ ...prev, category: updatedCategory }));
      setSelectedCategory(categoryId || '');
    } catch (error) {
      console.error('Failed to assign category:', error);
      window.alert('Failed to assign category');
    }
  };

  const assignOfficer = async (officerId) => {
    if (!complaint) return;

    try {
      await apiService.updateComplaint(complaint.complaint_id, { assigned_to: officerId || null });
      const updatedOfficer = officerId
        ? officers.find((off) => String(off.id) === String(officerId))
        : null;

      setComplaint((prev) => ({
        ...prev,
        assigned_to: updatedOfficer,
        assigned_officer: updatedOfficer,
      }));
    } catch (error) {
      console.error('Failed to assign officer:', error);
      window.alert('Failed to assign officer');
    }
  };

  const addResponse = async () => {
    if (!complaint || !newResponse.trim() || !responseTitle.trim()) {
      window.alert('Please fill in both title and message');
      return;
    }

    try {
      await apiService.addComplaintResponse(complaint.complaint_id, {
        title: responseTitle,
        message: newResponse,
        response_type: responseType,
        is_public: true,
      });

      setNewResponse('');
      setResponseTitle('');
      setResponseType('update');
      await loadResponses();
    } catch (error) {
      console.error('Failed to add response:', error);
      window.alert('Failed to add response. Please try again.');
    }
  };

  const loadReassignmentData = async () => {
    try {
      const [resolversData, levelsData] = await Promise.all([
        apiService.getAllCategoryResolvers(),
        apiService.getResolverLevels(),
      ]);

      setCategoryResolvers(resolversData.results || resolversData || []);
      setLevels(levelsData.results || levelsData || []);

      if (complaint?.category?.category_id) {
        setSelectedCategory(complaint.category.category_id);
      }
    } catch (error) {
      console.error('Failed to load reassignment data:', error);
    }
  };

  const recommendedOfficers = useMemo(() => {
    if (!selectedCategory) return officers;

    const categoryOfficers = categoryResolvers
      .filter(
        (resolver) =>
          String(resolver.category) === String(selectedCategory) &&
          resolver.active &&
          (!selectedLevel || String(resolver.level) === String(selectedLevel))
      )
      .map((resolver) => resolver.officer);

    const categoryOfficerIds = [...new Set(categoryOfficers.map((id) => String(id)))];

    const recommended = officers.filter((officer) => categoryOfficerIds.includes(String(officer.id)));
    const others = officers.filter((officer) => !categoryOfficerIds.includes(String(officer.id)));

    return [...recommended, ...others];
  }, [officers, categoryResolvers, selectedCategory, selectedLevel]);

  const handleReassign = async () => {
    if (!reassignOfficerId || !complaint) {
      window.alert('Please select an officer to reassign to');
      return;
    }

    try {
      await apiService.reassignComplaint(complaint.complaint_id, {
        officer_id: reassignOfficerId,
        reason: reassignReason || 'Reassigned by admin',
      });

      const updatedOfficer = officers.find((off) => String(off.id) === String(reassignOfficerId));
      setComplaint((prev) => ({
        ...prev,
        assigned_to: updatedOfficer,
        assigned_officer: updatedOfficer,
      }));

      window.alert('Complaint reassigned successfully');
      setShowReassignModal(false);
      setReassignOfficerId('');
      setReassignReason('');
      setSelectedLevel('');
    } catch (error) {
      console.error('Failed to reassign complaint:', error);
      window.alert(`Failed to reassign: ${error.message || 'Unknown error'}`);
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
          <div className="text-lg text-gray-500">Loading complaint details...</div>
        </div>
      </div>
    );
  }

  if (!complaint) {
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
          activeItem="complaints"
          onItemClick={(id) => {
            navigate(`/admin?tab=${id}`);
            setSidebarOpen(false);
          }}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => {
            navigate('/admin?tab=profile');
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
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate('/admin?tab=complaints')}
                className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Back to Complaints
              </button>
              <button
                onClick={loadPageData}
                className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
              >
                Refresh
              </button>
            </div>

            <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
              <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{complaint.title}</h2>
              <p className={`mt-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{complaint.description}</p>

              <div className="mt-4 flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusBadge(complaint.status)}`}>
                  {(complaint.status || 'pending').replace('_', ' ').toUpperCase()}
                </span>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>ID: {complaint.complaint_id}</span>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Submitted by:</span>
                  <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {complaint.submitted_by?.first_name} {complaint.submitted_by?.last_name}
                  </span>
                </div>
                <div>
                  <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Created:</span>
                  <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {new Date(complaint.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Updated:</span>
                  <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {new Date(complaint.updated_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </section>

            <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 space-y-4`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</label>
                  <select
                    value={complaint.status}
                    onChange={(e) => updateComplaintStatus(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="escalated">Escalated</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Category</label>
                  <select
                    value={complaint.category?.category_id || ''}
                    onChange={(e) => assignCategory(e.target.value)}
                    className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="">No Category</option>
                    {categories.map((category) => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Assigned To</label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={complaint.assigned_to?.id || complaint.assigned_officer?.id || ''}
                      onChange={(e) => assignOfficer(e.target.value)}
                      className={`w-full rounded px-3 py-2 border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    >
                      <option value="">Unassigned</option>
                      {officers.map((officer) => (
                        <option key={officer.id} value={officer.id}>
                          {officer.first_name} {officer.last_name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setShowReassignModal(true);
                        loadReassignmentData();
                      }}
                      className="text-xs px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                      title="Reassign with reason"
                    >
                      Reassign
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {complaint.attachments?.length > 0 && (
              <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-3`}>Attachments</h3>
                <div className="space-y-2">
                  {complaint.attachments.map((attachment, index) => (
                    <div key={index} className={`flex items-center p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <span className="text-lg mr-2">📎</span>
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {attachment.filename}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-3`}>Add Admin Response</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={responseType}
                    onChange={(e) => setResponseType(e.target.value)}
                    className={`w-full border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="initial">Initial Response</option>
                    <option value="update">Status Update</option>
                    <option value="resolution">Final Resolution</option>
                    <option value="escalation">Escalation Response</option>
                  </select>
                  <input
                    type="text"
                    value={responseTitle}
                    onChange={(e) => setResponseTitle(e.target.value)}
                    placeholder="Response title..."
                    className={`w-full border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                  />
                </div>

                <div className="flex space-x-2">
                  <textarea
                    value={newResponse}
                    onChange={(e) => setNewResponse(e.target.value)}
                    placeholder="Write your admin response..."
                    className={`flex-1 border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                    rows="3"
                  />
                  <button
                    onClick={addResponse}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded"
                  >
                    Add Admin Response
                  </button>
                </div>
              </div>
            </section>

            {responses.length > 0 && (
              <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-3`}>All Responses</h3>
                <div className="space-y-3">
                  {responses.map((response, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded border-l-4 ${response.response_type === 'resolution'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : response.response_type === 'escalation'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : response.response_type === 'initial'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {response.title}
                          </h5>
                          <span className="text-xs px-2 py-1 rounded mt-1 inline-block bg-gray-100 text-gray-700">
                            {response.response_type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {new Date(response.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>{response.message}</p>
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        By {response.responder?.first_name || 'Admin'} {response.responder?.last_name || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {showReassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Reassign Complaint
            </h3>

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Filter by Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setReassignOfficerId('');
                }}
                className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCategory && levels.length > 0 && (
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Filter by Level (Optional)
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => {
                    setSelectedLevel(e.target.value);
                    setReassignOfficerId('');
                  }}
                  className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="">All Levels</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name} (Level {level.level_order})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Select Officer
              </label>
              <select
                value={reassignOfficerId}
                onChange={(e) => setReassignOfficerId(e.target.value)}
                className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">Select an officer...</option>
                {recommendedOfficers.map((officer) => {
                  const isRecommended = selectedCategory && categoryResolvers.some(
                    (resolver) =>
                      String(resolver.officer) === String(officer.id) &&
                      String(resolver.category) === String(selectedCategory) &&
                      resolver.active &&
                      (!selectedLevel || String(resolver.level) === String(selectedLevel))
                  );

                  return (
                    <option key={officer.id} value={officer.id}>
                      {isRecommended ? 'STAR ' : ''}{officer.first_name} {officer.last_name} ({officer.email})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Reason (Optional)
              </label>
              <textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Enter reason for reassignment..."
                className={`w-full p-2 border rounded h-20 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setReassignOfficerId('');
                  setReassignReason('');
                  setSelectedLevel('');
                }}
                className={`px-4 py-2 rounded ${isDark ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={!reassignOfficerId}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reassign Complaint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminComplaintDetail;