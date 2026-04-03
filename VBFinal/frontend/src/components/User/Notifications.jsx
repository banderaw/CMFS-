import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const Notifications = ({ setUnreadCount }) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [complaintsData, apptsRes] = await Promise.all([
        apiService.getComplaints(),
        fetch('/api/appointments/', { headers }).then(r => r.json()),
      ]);

      const userComplaints = (complaintsData.results || complaintsData).filter(
        complaint => complaint.submitted_by?.id === user?.id
      );

      const appts = (apptsRes.results ?? apptsRes);
      const apptNotifications = Array.isArray(appts)
        ? appts.map((appt) => ({
          id: `appt-${appt.id}`,
          type: 'appointment',
          title: appt.status === 'confirmed' ? '📅 Appointment Confirmed' : appt.status === 'cancelled' ? '❌ Appointment Cancelled' : '📅 Appointment Scheduled',
          message: `An appointment has been ${appt.status} for your complaint "${appt.complaint_title}". Scheduled: ${new Date(appt.scheduled_at).toLocaleString()}${appt.location ? ` at ${appt.location}` : ''}.`,
          complaint_id: appt.complaint,
          read: appt.status === 'completed',
          created_at: appt.created_at || new Date().toISOString(),
        }))
        : [];

      const staticNotifications = [
        {
          id: 1,
          type: 'status_update',
          title: 'Complaint Status Updated',
          message: 'Your complaint has been assigned to an officer and is now in progress.',
          complaint_id: userComplaints[0]?.complaint_id,
          read: false,
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          type: 'new_comment',
          title: 'New Comment on Your Complaint',
          message: 'An officer has added a comment requesting additional information.',
          complaint_id: userComplaints[0]?.complaint_id,
          read: false,
          created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 3,
          type: 'resolved',
          title: 'Complaint Resolved',
          message: 'Your complaint has been successfully resolved. Please review the resolution.',
          complaint_id: userComplaints[1]?.complaint_id,
          read: true,
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 4,
          type: 'reminder',
          title: 'Feedback Requested',
          message: 'Please provide feedback on your recently resolved complaint.',
          complaint_id: userComplaints[1]?.complaint_id,
          read: false,
          created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
      ].filter(n => n.complaint_id);

      setNotifications([...apptNotifications, ...staticNotifications]);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const unreadCount = notifications.filter(n => !n.read).length;
    setUnreadCount(unreadCount);
  }, [notifications, setUnreadCount]);

  const markAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const deleteNotification = (notificationId) => {
    setNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );
  };

  const getNotificationIcon = (type) => {
    const icons = {
      status_update: '🔄',
      new_comment: '💬',
      resolved: '✅',
      escalated: '⬆️',
      reminder: '⏰',
      appointment: '📅',
      default: '📢'
    };
    return icons[type] || icons.default;
  };

  const getNotificationColor = (type) => {
    const colors = {
      status_update: 'text-blue-500',
      new_comment: 'text-green-500',
      resolved: 'text-green-600',
      escalated: 'text-orange-500',
      reminder: 'text-purple-500',
      appointment: 'text-blue-600',
      default: 'text-gray-500'
    };
    return colors[type] || colors.default;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading notifications...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Notifications
          </h3>
          <button
            onClick={markAllAsRead}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            Mark All Read
          </button>
        </div>

        <div className="flex space-x-1">
          {['all', 'unread', 'read'].map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-3 py-1 rounded text-sm transition-colors ${filter === filterType
                  ? 'bg-blue-500 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              {filterType === 'unread' && (
                <span className="ml-1 bg-red-500 text-white text-xs px-1 rounded-full">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              No notifications
            </h3>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {filter === 'unread'
                ? "You're all caught up! No unread notifications."
                : filter === 'read'
                  ? "No read notifications to show."
                  : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 transition-colors ${!notification.read
                    ? isDark ? 'bg-gray-750 hover:bg-gray-700' : 'bg-blue-50 hover:bg-blue-100'
                    : isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className={`text-2xl ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </div>
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{getTimeAgo(notification.created_at)}</span>
                        {notification.complaint_id && (
                          <span>Complaint: {notification.complaint_id.slice(0, 8)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1 text-red-500 hover:text-red-700 transition-colors"
                      title="Delete notification"
                    >
                      ✕
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

export default Notifications;
