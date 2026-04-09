export const OFFICER_NAV_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
  { id: 'complaints', name: 'Manage Complaints', icon: '📋' },
  { id: 'announcements', name: 'Public Announcements', icon: '📢' },
  { id: 'schedule', name: 'Schedule', icon: '📅' },
  { id: 'create-template', name: 'Create Template', icon: '➕' },
  { id: 'manage-templates', name: 'Manage Templates', icon: '📝' },
  { id: 'helpdesk', name: 'Helpdesk', icon: '🎧' },
  { id: 'profile', name: 'Profile', icon: '👤' },
];

export const getUserNavItems = (t, unreadCount = 0) => [
  { id: 'submit', icon: '📝', name: t('submit_complaint') },
  { id: 'my-complaints', icon: '📋', name: t('my_complaints') },
  { id: 'appointments', icon: '📅', name: t('appointments') },
  { id: 'notifications', icon: '🔔', name: t('notifications'), badge: unreadCount },
  { id: 'feedback', icon: '💬', name: t('feedback') },
  { id: 'helpdesk', icon: '🎧', name: 'Helpdesk' },
  { id: 'profile', icon: '👤', name: t('profile') },
];
