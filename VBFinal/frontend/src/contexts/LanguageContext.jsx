import React, { createContext, useContext } from 'react';

const LanguageContext = createContext();

const translations = {
  admin_panel: 'Admin Panel',
  officer_panel: 'Officer Panel',
  student_portal: 'Student Portal',
  complaint_system: 'Complaint System',
  complaint_management: 'Complaint Management',
  dashboard: 'Dashboard',
  overview: 'Overview',
  submit_complaint: 'Submit Complaint',
  my_complaints: 'My Complaints',
  appointments: 'Appointments',
  assigned_complaints: 'Assigned Complaints',
  notifications: 'Notifications',
  profile: 'Profile',
  settings: 'Settings',
  users: 'Users',
  institutions: 'Institutions',
  categories: 'Categories',
  resolver_levels: 'Resolver Levels',
  assignments: 'Assignments',
  system: 'System',
  title: 'Title',
  description: 'Description',
  institution: 'Institution',
  category: 'Category',
  status: 'Status',
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  role: 'Role',
  password: 'Password',
  current_password: 'Current Password',
  new_password: 'New Password',
  confirm_password: 'Confirm New Password',
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  escalated: 'Escalated',
  closed: 'Closed',
  submit: 'Submit',
  update: 'Update',
  delete: 'Delete',
  edit: 'Edit',
  view: 'View',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  loading: 'Loading...',
  no_data: 'No data found',
  required: 'Required',
  submit_new_complaint: 'Submit New Complaint',
  complaint_submitted: 'Complaint submitted successfully! You will receive updates via email.',
  brief_title: 'Brief title of your complaint',
  detailed_description: 'Detailed description of your complaint',
  select_institution: 'Select Institution',
  mark_all_read: 'Mark all as read',
  all: 'All',
  unread: 'Unread',
  read: 'Read',
  loading_notifications: 'Loading notifications...',
  no_notifications_title: 'No notifications',
  all_caught_up: "You're all caught up! No unread notifications.",
  no_read_notifications: 'No read notifications to show.',
  no_notifications_yet: "You don't have any notifications yet.",
  mark_as_read: 'Mark as read',
  delete_notification: 'Delete notification',
  appointment_confirmed: 'Appointment Confirmed',
  appointment_cancelled: 'Appointment Cancelled',
  appointment_scheduled: 'Appointment Scheduled',
  appointment_scheduled_by_officers: 'Appointments scheduled by officers for your complaints',
  no_appointments_yet: 'No appointments from officers yet',
  appointments_will_appear: 'Scheduled appointments from officers will appear here.',
  complaint_assigned: 'Your complaint has been assigned to an officer',
  status_updated: 'Status updated: In Progress',
  new_comment: 'New comment on your complaint',
  feedback: 'Feedback',
  logout: 'Logout',
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const t = (key) => translations[key] || key;

  return (
    <LanguageContext.Provider value={{ language: 'en', t }}>
      {children}
    </LanguageContext.Provider>
  );
};
