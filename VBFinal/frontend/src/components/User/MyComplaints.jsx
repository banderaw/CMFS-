import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';

const MyComplaints = ({ getStatusBadge }) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all'
  });
  const [loading, setLoading] = useState(true);

  const loadComplaints = useCallback(async () => {
    try {
      const data = await apiService.getComplaints();
      const userComplaints = (data.results || data).filter(
        complaint => complaint.submitted_by?.id === user?.id
      );
      setComplaints(userComplaints);
    } catch (error) {
      console.error('Failed to load complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadComplaints();
    loadCategories();

    const interval = setInterval(() => {
      loadComplaints();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadComplaints]);

  const loadCategories = async () => {
    try {
      const data = await apiService.getCategories();
      setCategories(data.results || data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = complaints;

    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter(c => c.category?.category_id === filters.category);
    }

    setFilteredComplaints(filtered);
  }, [complaints, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const getStats = () => {
    const total = complaints.length;
    const pending = complaints.filter(c => c.status === 'pending').length;
    const inProgress = complaints.filter(c => c.status === 'in_progress').length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;

    return { total, pending, inProgress, resolved };
  };

  const handleDeleteComplaint = async (complaintId) => {
    if (!confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteComplaint(complaintId);
      loadComplaints();
    } catch (error) {
      console.error('Failed to delete complaint:', error);
      alert('Failed to delete complaint. Please try again.');
    }
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-blue-500">{stats.total}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Complaints</div>
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
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Filter Complaints
          </h3>
          <button
            onClick={() => loadComplaints()}
            className={`px-3 py-1 rounded text-sm transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            title="Refresh to see latest updates"
          >
            🔄 Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* Complaints List */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        {filteredComplaints.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              No complaints found
            </h3>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {complaints.length === 0
                ? "You haven't submitted any complaints yet."
                : "No complaints match your current filters."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredComplaints.map((complaint) => (
              <div key={complaint.complaint_id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {complaint.title}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(complaint.status)}`}>
                        {complaint.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                      {complaint.description.length > 100
                        ? `${complaint.description.substring(0, 100)}...`
                        : complaint.description}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>ID: {complaint.complaint_id.slice(0, 8)}</span>
                      <span>Category: {complaint.category?.name || 'Uncategorized'}</span>
                      <span>Created: {new Date(complaint.created_at).toLocaleDateString()}</span>
                      {complaint.attachments?.length > 0 && (
                        <span className="flex items-center">
                          📎 {complaint.attachments.length} file(s)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        navigate(`/user/complaints/${complaint.complaint_id}`);
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                    >
                      View Details
                    </button>
                    {(complaint.status === 'pending' || complaint.status === 'draft') && (
                      <button
                        onClick={() => handleDeleteComplaint(complaint.complaint_id)}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                        title="Delete complaint"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyComplaints;
