import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import { openRealtimeSocket } from '../../services/realtime';

const Notifications = ({ setUnreadCount }) => {
  const { isDark } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const socketRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const [notificationsData, appointmentsData] = await Promise.all([
        apiService.getNotifications(),
        apiService.getAppointments(),
      ]);

      const storedNotifications = (notificationsData.results ?? notificationsData ?? []).map((notification) => ({
        ...notification,
        type: notification.notification_type,
        read: notification.is_read,
      }));

      const appointments = appointmentsData.results ?? appointmentsData ?? [];
      const appointmentNotifications = Array.isArray(appointments)
        ? appointments.map((appointment) => ({
          id: `appt-${appointment.id}`,
          type: 'appointment',
          title: appointment.status === 'confirmed'
            ? 'Appointment Confirmed'
            : appointment.status === 'cancelled'
              ? 'Appointment Cancelled'
              : 'Appointment Scheduled',
          message: `An appointment has been ${appointment.status} for your complaint "${appointment.complaint_title}". Scheduled: ${new Date(appointment.scheduled_at).toLocaleString()}${appointment.location ? ` at ${appointment.location}` : ''}.`,
          complaint_id: appointment.complaint,
          read: appointment.status === 'completed',
          created_at: appointment.created_at || new Date().toISOString(),
        }))
        : [];

      setNotifications(
        [...storedNotifications, ...appointmentNotifications].sort(
          (left, right) => new Date(right.created_at) - new Date(left.created_at),
        ),
      );
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    let mounted = true;
    const socket = openRealtimeSocket('/ws/notifications/', {
      onMessage: () => {
        if (mounted) loadNotifications();
      },
      onClose: () => {
        if (mounted) {
          // Polling fallback keeps the list fresh if websocket connectivity drops.
        }
      },
    });

    socketRef.current = socket;
    const refreshInterval = setInterval(loadNotifications, 30000);

    return () => {
      mounted = false;
      if (socket) socket.close();
      clearInterval(refreshInterval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const unreadCount = notifications.filter(notification => !notification.read).length;
    setUnreadCount(unreadCount);
  }, [notifications, setUnreadCount]);

  const markAsRead = async (notificationId) => {
    if (`${notificationId}`.startsWith('appt-')) {
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId ? { ...notification, read: true } : notification
        )
      );
      return;
    }

    try {
      await apiService.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true, is_read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }

    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true, is_read: true }))
    );
  };

  const deleteNotification = (notificationId) => {
    setNotifications(prev =>
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
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
                  {notifications.filter(notification => !notification.read).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              No notifications
            </h3>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {filter === 'unread'
                ? "You're all caught up! No unread notifications."
                : filter === 'read'
                  ? 'No read notifications to show.'
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
                          <span>Complaint: {`${notification.complaint_id}`.slice(0, 8)}</span>
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
                        Read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1 text-red-500 hover:text-red-700 transition-colors"
                      title="Delete notification"
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
    </div >
  );
};

export default Notifications;
