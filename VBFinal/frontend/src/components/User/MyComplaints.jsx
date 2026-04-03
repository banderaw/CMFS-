import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const MyComplaints = ({ getStatusBadge }) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all'
  });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [responses, setResponses] = useState([]);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [newComment, setNewComment] = useState('');

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

  const loadResponses = async (complaintId) => {
    try {
      const data = await apiService.getComplaintResponses(complaintId);
      setResponses(data.results || data || []);
    } catch (error) {
      console.error('Failed to load responses:', error);
      setResponses([]);
    }
  };

  const handleDeleteComplaint = async (complaintId) => {
    if (!confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteComplaint(complaintId);
      // Refresh complaints list
      loadComplaints();
      // Close modal if the deleted complaint was being viewed
      if (selectedComplaint?.complaint_id === complaintId) {
        setShowModal(false);
        setSelectedComplaint(null);
      }
    } catch (error) {
      console.error('Failed to delete complaint:', error);
      alert('Failed to delete complaint. Please try again.');
    }
  };

  const loadComments = async (complaintId) => {
    try {
      const data = await apiService.getComplaintComments(complaintId);
      // Filter to show only user's own comments and ratings
      const userComments = (data.results || data || []).filter(
        comment => comment.author?.id === user?.id
      );
      setComments(userComments);
    } catch (error) {
      console.error('Failed to load comments:', error);
      setComments([]);
    }
  };

  const editComment = async (commentId, newMessage) => {
    try {
      await apiService.updateComment(commentId, { message: newMessage });
      setEditingComment(null);
      await loadComments(selectedComplaint.complaint_id);
    } catch (error) {
      console.error('Failed to update comment:', error);
      alert('Failed to update comment.');
    }
  };

  const deleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await apiService.deleteComment(commentId);
      await loadComments(selectedComplaint.complaint_id);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment.');
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) {
      alert('Please enter a comment.');
      return;
    }

    try {
      await apiService.createComment({
        complaint: selectedComplaint.complaint_id,
        message: newComment,
        comment_type: 'comment'
      });
      setNewComment('');
      await loadComments(selectedComplaint.complaint_id);
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment.');
    }
  };

  const submitRating = async () => {
    if (!rating || !selectedComplaint) {
      alert('Please select a rating before submitting.');
      return;
    }

    try {
      await apiService.addComplaintRating(selectedComplaint.complaint_id, rating, feedback);
      setShowRatingForm(false);
      setRating(0);
      setFeedback('');
      alert(`Thank you! You rated this resolution ${rating}/5 stars.`);
    } catch (error) {
      console.error('Failed to submit rating:', error);
      alert('Failed to submit rating. Please try again.');
    }
  };

  const stats = getStats();
  const hasOfficerResponse = responses.length > 0;

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
            <div className="text-4xl mb-4">📝</div>
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
                        setSelectedComplaint(complaint);
                        setShowModal(true);
                        loadResponses(complaint.complaint_id);
                        loadComments(complaint.complaint_id);
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
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>ID:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedComplaint.complaint_id}
                    </span>
                  </div>
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Category:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedComplaint.category?.name || 'Uncategorized'}
                    </span>
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

                {/* Officer Responses */}
                {responses.length > 0 && (
                  <div className="mt-6">
                    <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                      Officer Responses:
                    </h4>
                    <div className="space-y-4">
                      {responses.map((response, index) => (
                        <div key={index} className={`p-4 rounded-lg border-l-4 ${response.response_type === 'resolution' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
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
                              By {response.responder?.first_name || 'Officer'} {response.responder?.last_name || ''}
                              {response.responder?.role === 'admin' && (
                                <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100 rounded text-xs">ADMIN</span>
                              )}
                            </span>
                            {response.attachment && (
                              <span className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'} flex items-center`}>
                                📎 Attachment
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {responses.length === 0 && (
                  <div className="mt-6">
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'} text-center`}>
                      <div className="text-2xl mb-2">⏳</div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        No responses yet. Our officers will respond to your complaint soon.
                      </p>
                    </div>
                  </div>
                )}

                {/* Rating Section */}
                {selectedComplaint.status === 'resolved' && (
                  <div className="mt-6">
                    {!hasOfficerResponse ? (
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          You can rate this complaint after an officer responds.
                        </p>
                      </div>
                    ) : !showRatingForm ? (
                      <button
                        onClick={() => setShowRatingForm(true)}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        Rate This Resolution
                      </button>
                    ) : (
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                          Rate the Resolution:
                        </h4>
                        <div className="flex items-center space-x-1 mb-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setRating(star)}
                              className={`text-3xl transition-all duration-200 hover:scale-110 ${star <= rating
                                ? 'text-yellow-400 drop-shadow-lg'
                                : isDark
                                  ? 'text-gray-600 hover:text-yellow-300'
                                  : 'text-gray-300 hover:text-yellow-400'
                                }`}
                            >
                              ★
                            </button>
                          ))}
                          <span className={`ml-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {rating > 0 && `${rating}/5 stars`}
                          </span>
                        </div>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Optional feedback about the resolution..."
                          className={`w-full p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'} mb-3`}
                          rows="3"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={submitRating}
                            disabled={!rating}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Submit Rating ({rating}/5)
                          </button>
                          <button
                            onClick={() => {
                              setShowRatingForm(false);
                              setRating(0);
                              setFeedback('');
                            }}
                            className={`px-4 py-2 rounded transition-colors ${isDark ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Comments Section */}
                <div className="mt-6">
                  <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                    Your Comments:
                  </h4>

                  {/* Add Comment */}
                  <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'} mb-4`}>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={hasOfficerResponse ? "Add a comment about this complaint..." : "Comments are available after an officer responds."}
                      className={`w-full p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'} mb-3`}
                      rows="3"
                      disabled={!hasOfficerResponse}
                    />
                    <button
                      onClick={addComment}
                      disabled={!hasOfficerResponse || !newComment.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Add Comment
                    </button>
                    {!hasOfficerResponse && (
                      <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        You can add comments after an officer responds to your complaint.
                      </p>
                    )}
                  </div>

                  {/* Existing Comments */}
                  <div className="space-y-3">
                    {comments.length === 0 ? (
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        No comments yet. Add your first comment above.
                      </p>
                    ) : (
                      comments.map((comment, index) => (
                        <div key={index} className={`p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              {editingComment === comment.id ? (
                                <textarea
                                  defaultValue={comment.message}
                                  onBlur={(e) => editComment(comment.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      editComment(comment.id, e.target.value);
                                    }
                                    if (e.key === 'Escape') {
                                      setEditingComment(null);
                                    }
                                  }}
                                  className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-500 text-white' : 'bg-white border-gray-300'}`}
                                  rows="2"
                                  autoFocus
                                />
                              ) : (
                                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {comment.message}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 ml-3">
                              {comment.comment_type === 'rating' && comment.rating && (
                                <span className="text-yellow-400 text-sm">
                                  {'★'.repeat(comment.rating)}
                                </span>
                              )}
                              <button
                                onClick={() => setEditingComment(editingComment === comment.id ? null : comment.id)}
                                className="text-blue-600 hover:text-blue-800 text-xs"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteComment(comment.id)}
                                className="text-red-600 hover:text-red-800 text-xs"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyComplaints;
