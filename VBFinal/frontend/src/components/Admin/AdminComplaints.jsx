import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const AdminComplaints = () => {
  const { isDark } = useTheme();
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [responses, setResponses] = useState([]);
  const [newResponse, setNewResponse] = useState('');
  const [responseTitle, setResponseTitle] = useState('');
  const [responseType, setResponseType] = useState('update');
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    institution: 'all'
  });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignOfficerId, setReassignOfficerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [levels, setLevels] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = complaints;

    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter(c => c.category?.category_id === filters.category);
    }
    if (filters.institution !== 'all') {
      filtered = filtered.filter(c => c.institution === parseInt(filters.institution));
    }

    setFilteredComplaints(filtered);
  }, [complaints, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const loadData = async () => {
    try {
      const [complaintsData, categoriesData, institutionsData, officersData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getCategories(),
        apiService.getInstitutions(),
        apiService.getAllUsers()
      ]);

      setComplaints(complaintsData.results || complaintsData);

      // Handle paginated categories - load all pages
      let allCategories = [];
      if (categoriesData.results) {
        allCategories = categoriesData.results;
        // If there are more pages, load them
        let nextUrl = categoriesData.next;
        while (nextUrl) {
          const nextPage = await fetch(nextUrl, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          const nextData = await nextPage.json();
          allCategories = [...allCategories, ...nextData.results];
          nextUrl = nextData.next;
        }
      } else {
        allCategories = categoriesData;
      }

      setCategories(allCategories);
      setInstitutions(institutionsData.results || institutionsData);

      // Filter officers (users with officer role)
      const allUsers = officersData.results || officersData;
      const officerUsers = allUsers.filter(user => user.role === 'officer' || user.is_staff);
      setOfficers(officerUsers);

    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateComplaintStatus = async (complaintId, newStatus) => {
    try {
      await apiService.updateComplaint(complaintId, { status: newStatus });
      setComplaints(prev =>
        prev.map(c =>
          c.complaint_id === complaintId ? { ...c, status: newStatus } : c
        )
      );
      if (selectedComplaint?.complaint_id === complaintId) {
        setSelectedComplaint(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error('Failed to update complaint status:', error);
      alert('Failed to update complaint status');
    }
  };

  const assignCategory = async (complaintId, categoryId) => {
    try {
      if (categoryId === '') {
        // Remove category assignment
        await apiService.updateComplaint(complaintId, { category: null });
      } else {
        // Assign category
        await apiService.updateComplaint(complaintId, { category: categoryId });
      }

      // Update the selected complaint in modal if it's the same complaint
      if (selectedComplaint?.complaint_id === complaintId) {
        const updatedCategory = categoryId ? categories.find(cat => cat.category_id === categoryId) : null;
        setSelectedComplaint(prev => ({ ...prev, category: updatedCategory }));
      }

      // Update the complaint in the main list
      setComplaints(prevComplaints =>
        prevComplaints.map(complaint =>
          complaint.complaint_id === complaintId
            ? {
              ...complaint,
              category: categoryId ? categories.find(cat => cat.category_id === categoryId) : null
            }
            : complaint
        )
      );

    } catch (error) {
      console.error('Failed to assign category:', error);
      alert('Failed to assign category');
    }
  };

  const assignOfficer = async (complaintId, officerId) => {
    try {
      if (officerId === '') {
        // Remove officer assignment
        await apiService.updateComplaint(complaintId, { assigned_to: null });
      } else {
        // Assign officer
        await apiService.updateComplaint(complaintId, { assigned_to: officerId });
      }

      // Update the selected complaint in modal if it's the same complaint
      if (selectedComplaint?.complaint_id === complaintId) {
        const updatedOfficer = officerId ? officers.find(off => off.id === parseInt(officerId)) : null;
        setSelectedComplaint(prev => ({ ...prev, assigned_to: updatedOfficer }));
      }

      // Update the complaint in the main list
      setComplaints(prevComplaints =>
        prevComplaints.map(complaint =>
          complaint.complaint_id === complaintId
            ? {
              ...complaint,
              assigned_to: officerId ? officers.find(off => off.id === parseInt(officerId)) : null
            }
            : complaint
        )
      );

    } catch (error) {
      console.error('Failed to assign officer:', error);
      alert('Failed to assign officer');
    }
  };

  const loadReassignmentData = async () => {
    try {
      const [resolversData, levelsData] = await Promise.all([
        apiService.getAllCategoryResolvers(),
        apiService.getResolverLevels()
      ]);

      setCategoryResolvers(resolversData.results || resolversData);
      setLevels(levelsData.results || levelsData);

      // Pre-select the complaint's category if available
      if (selectedComplaint?.category?.category_id) {
        setSelectedCategory(selectedComplaint.category.category_id);
      }
    } catch (error) {
      console.error('Failed to load reassignment data:', error);
    }
  };

  const getRecommendedOfficers = () => {
    if (!selectedCategory) return officers;

    // Get officers assigned to the selected category
    const categoryOfficers = categoryResolvers
      .filter(resolver =>
        resolver.category === selectedCategory &&
        resolver.active &&
        (!selectedLevel || resolver.level === selectedLevel)
      )
      .map(resolver => resolver.officer);

    // Get unique officer IDs
    const categoryOfficerIds = [...new Set(categoryOfficers)];

    // Return officers assigned to this category, then all other officers
    const recommended = officers.filter(officer =>
      categoryOfficerIds.includes(officer.id)
    );
    const others = officers.filter(officer =>
      !categoryOfficerIds.includes(officer.id)
    );

    return [...recommended, ...others];
  };

  const handleReassign = async () => {
    if (!reassignOfficerId) {
      alert('Please select an officer to reassign to');
      return;
    }

    try {
      await apiService.reassignComplaint(selectedComplaint.complaint_id, {
        officer_id: reassignOfficerId,
        reason: reassignReason || 'Reassigned by admin'
      });

      // Update UI
      const updatedOfficer = officers.find(off => off.id === parseInt(reassignOfficerId));
      setSelectedComplaint(prev => ({ ...prev, assigned_officer: updatedOfficer }));
      setComplaints(prev =>
        prev.map(c =>
          c.complaint_id === selectedComplaint.complaint_id
            ? { ...c, assigned_officer: updatedOfficer }
            : c
        )
      );

      alert('Complaint reassigned successfully');
      setShowReassignModal(false);
      setReassignOfficerId('');
      setReassignReason('');
      setSelectedCategory('');
      setSelectedLevel('');
    } catch (error) {
      console.error('Failed to reassign complaint:', error);
      alert('Failed to reassign: ' + (error.message || 'Unknown error'));
    }
  };

  const loadResponses = async (complaintId) => {
    try {
      const data = await apiService.getComplaintResponses(complaintId);
      setResponses(data.results || data || []);
    } catch (error) {
      console.error('Failed to load responses:', error);
      setResponses([]);
    }
  };

  const addResponse = async () => {
    if (!newResponse.trim() || !responseTitle.trim()) {
      alert('Please fill in both title and message');
      return;
    }

    try {
      await apiService.addComplaintResponse(selectedComplaint.complaint_id, {
        title: responseTitle,
        message: newResponse,
        response_type: responseType,
        is_public: true
      });
      setNewResponse('');
      setResponseTitle('');
      setResponseType('update');
      await loadResponses(selectedComplaint.complaint_id);
    } catch (error) {
      console.error('Failed to add response:', error);
      alert('Failed to add response. Please try again.');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      escalated: 'bg-red-100 text-red-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };



  const getStats = () => {
    const total = complaints.length;
    const pending = complaints.filter(c => c.status === 'pending').length;
    const inProgress = complaints.filter(c => c.status === 'in_progress').length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;
    const urgent = complaints.filter(c => c.priority === 'urgent').length;


    return { total, pending, inProgress, resolved, urgent };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading complaints...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-blue-500">{stats.total}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total</div>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pending</div>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>In Progress</div>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Resolved</div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Institution
            </label>
            <select
              value={filters.institution}
              onChange={(e) => setFilters({ ...filters, institution: e.target.value })}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Institutions</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Complaints Table */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        {filteredComplaints.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">📝</div>
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              No complaints found
            </h3>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              No complaints match your current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Complaint
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Status
                  </th>

                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Category
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Submitted
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200`}>
                {filteredComplaints.map((complaint) => (
                  <tr key={complaint.complaint_id} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {complaint.title}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          ID: {complaint.complaint_id.slice(0, 8)}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          By: {complaint.submitted_by?.first_name} {complaint.submitted_by?.last_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={complaint.status}
                        onChange={(e) => updateComplaintStatus(complaint.complaint_id, e.target.value)}
                        className={`text-sm rounded px-2 py-1 ${getStatusBadge(complaint.status)} border-0`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                        <option value="escalated">Escalated</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {complaint.category?.name || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(complaint.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => {
                          setSelectedComplaint(complaint);
                          setShowModal(true);
                          loadResponses(complaint.complaint_id);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Complaint Details
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                  {selectedComplaint.title}
                </h3>
                <div className="flex items-center space-x-2 mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${getStatusBadge(selectedComplaint.status)}`}>
                    {selectedComplaint.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                  {selectedComplaint.description}
                </p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Submitted by:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedComplaint.submitted_by?.first_name} {selectedComplaint.submitted_by?.last_name}
                    </span>
                  </div>
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Category:</span>
                    <select
                      value={selectedComplaint.category?.category_id || ''}
                      onChange={(e) => assignCategory(selectedComplaint.complaint_id, e.target.value)}
                      className={`ml-2 text-sm rounded px-2 py-1 border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    >
                      <option value="">No Category</option>
                      {categories.map(category => (
                        <option key={category.category_id} value={category.category_id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Assigned to:</span>
                    <div className="ml-2 inline-flex items-center space-x-2">
                      <select
                        value={selectedComplaint.assigned_to?.id || ''}
                        onChange={(e) => assignOfficer(selectedComplaint.complaint_id, e.target.value)}
                        className={`text-sm rounded px-2 py-1 border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                      >
                        <option value="">Unassigned</option>
                        {officers.map(officer => (
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
                        className="text-xs px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                        title="Reassign with reason"
                      >
                        🔄 Reassign
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Created:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {new Date(selectedComplaint.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Updated:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {new Date(selectedComplaint.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {selectedComplaint.attachments?.length > 0 && (
                  <div className="mt-4">
                    <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                      Attachments:
                    </h4>
                    <div className="space-y-2">
                      {selectedComplaint.attachments.map((attachment, index) => (
                        <div key={index} className={`flex items-center p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <span className="text-lg mr-2">📎</span>
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {attachment.filename}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Response Section */}
                <div className="mt-6">
                  <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                    Add Admin Response
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
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
                      </div>
                      <div>
                        <input
                          type="text"
                          value={responseTitle}
                          onChange={(e) => setResponseTitle(e.target.value)}
                          placeholder="Response title..."
                          className={`w-full border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                        />
                      </div>
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
                        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded transition-colors"
                      >
                        Add Admin Response
                      </button>
                    </div>
                  </div>
                </div>

                {/* Existing Responses */}
                {responses.length > 0 && (
                  <div className="mt-6">
                    <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                      All Responses
                    </h4>
                    <div className="space-y-3">
                      {responses.map((response, index) => (
                        <div key={index} className={`p-4 rounded border-l-4 ${response.response_type === 'resolution' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                            response.response_type === 'escalation' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                              response.response_type === 'initial' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                                'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                          }`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h5 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {response.title}
                              </h5>
                              <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${response.response_type === 'resolution' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                                  response.response_type === 'escalation' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' :
                                    response.response_type === 'initial' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' :
                                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                                }`}>
                                {response.response_type.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {new Date(response.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                            {response.message}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              By {response.responder?.first_name || 'Admin'} {response.responder?.last_name || ''}
                              {response.responder?.role === 'admin' && (
                                <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">ADMIN</span>
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassignment Modal */}
      {showReassignModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              🔄 Reassign Complaint
            </h3>

            {/* Complaint Info */}
            <div className={`mb-4 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-blue-50'}`}>
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {selectedComplaint.title}
              </p>
              <div className="flex items-center space-x-4 mt-2 text-sm">
                <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                  Current Category: <strong>{selectedComplaint.category?.name || 'None'}</strong>
                </span>
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Filter by Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setReassignOfficerId(''); // Reset officer selection
                }}
                className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Filter officers by category assignment
              </p>
            </div>

            {/* Level Filter */}
            {selectedCategory && levels.length > 0 && (
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Filter by Level (Optional)
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => {
                    setSelectedLevel(e.target.value);
                    setReassignOfficerId(''); // Reset officer selection
                  }}
                  className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="">All Levels</option>
                  {levels.map(level => (
                    <option key={level.id} value={level.id}>
                      {level.name} (Level {level.level_order})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Officer Selection */}
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Select Officer * {selectedCategory && '(Recommended officers shown first)'}
              </label>
              <select
                value={reassignOfficerId}
                onChange={(e) => setReassignOfficerId(e.target.value)}
                className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">Select an officer...</option>
                {getRecommendedOfficers().map((officer) => {
                  const isRecommended = selectedCategory && categoryResolvers.some(
                    resolver => resolver.officer === officer.id &&
                      resolver.category === selectedCategory &&
                      resolver.active &&
                      (!selectedLevel || resolver.level === selectedLevel)
                  );
                  return (
                    <option key={officer.id} value={officer.id}>
                      {isRecommended ? '⭐ ' : ''}{officer.first_name} {officer.last_name} ({officer.email})
                      {isRecommended ? ' - Assigned to this category' : ''}
                    </option>
                  );
                })}
              </select>
              {selectedCategory && (
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  ⭐ Officers marked with a star are assigned to handle the selected category
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Reason (Optional)
              </label>
              <textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Enter reason for reassignment (e.g., expertise, workload balancing, escalation)..."
                className={`w-full p-2 border rounded h-20 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setReassignOfficerId('');
                  setReassignReason('');
                  setSelectedCategory('');
                  setSelectedLevel('');
                }}
                className={`px-4 py-2 rounded ${isDark ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={!reassignOfficerId}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <span>🔄</span>
                <span>Reassign Complaint</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminComplaints;
