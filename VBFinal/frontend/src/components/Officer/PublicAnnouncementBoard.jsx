import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const PublicAnnouncementBoard = () => {
  const { isDark } = useTheme();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    message: '',
    is_pinned: false,
    expires_at: ''
  });

  const loadAnnouncements = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getPublicAnnouncements();
      const items = Array.isArray(data) ? data : data.results || [];
      setAnnouncements(items);
    } catch (err) {
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        is_pinned: form.is_pinned,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null
      };

      if (editingId) {
        await apiService.updatePublicAnnouncement(editingId, payload);
      } else {
        await apiService.createPublicAnnouncement(payload);
      }

      setEditingId(null);
      setForm({ title: '', message: '', is_pinned: false, expires_at: '' });
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || `Failed to ${editingId ? 'update' : 'create'} announcement`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      message: item.message || '',
      is_pinned: !!item.is_pinned,
      expires_at: item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ title: '', message: '', is_pinned: false, expires_at: '' });
    setError('');
  };

  const handleToggleActive = async (item) => {
    try {
      if (item.is_active) {
        await apiService.hidePublicAnnouncement(item.id);
      } else {
        await apiService.showPublicAnnouncement(item.id);
      }
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || `Failed to ${item.is_active ? 'hide' : 'show'} announcement`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deletePublicAnnouncement(id);
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to delete announcement');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Public Announcement Board</h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-5 space-y-4`}
      >
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {editingId ? 'Edit Announcement' : 'Post New Announcement'}
        </h3>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className={`w-full rounded-lg px-3 py-2 border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            placeholder="Announcement title"
            maxLength={200}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Message</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
            className={`w-full rounded-lg px-3 py-2 border min-h-28 ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            placeholder="What should users know?"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm((prev) => ({ ...prev, is_pinned: e.target.checked }))}
            />
            Pin this announcement
          </label>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Expires At (optional)</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
              className={`w-full rounded-lg px-3 py-2 border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting
              ? (editingId ? 'Updating...' : 'Posting...')
              : (editingId ? 'Update Announcement' : 'Post Announcement')}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className={`px-5 py-2.5 rounded-lg font-semibold border ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-2">
          {error}
        </div>
      )}

      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Your Announcements</h3>

        {loading ? (
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No announcements posted yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-4 ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.is_pinned ? '📌 ' : ''}
                      {item.title}
                    </h4>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.message}</p>
                    <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Created: {new Date(item.created_at).toLocaleString()}
                      {item.expires_at ? ` | Expires: ${new Date(item.expires_at).toLocaleString()}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => handleToggleActive(item)}
                      className="px-3 py-1.5 text-xs rounded bg-yellow-500 text-white hover:bg-yellow-600"
                    >
                      {item.is_active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
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

export default PublicAnnouncementBoard;
