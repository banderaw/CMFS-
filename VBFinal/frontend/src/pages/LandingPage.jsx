import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';
import PublicNavbar from '../components/UI/PublicNavbar';
import PublicFooter from '../components/UI/PublicFooter';

const developers = [
  { name: 'student ', role: 'Full Stack Developer', email: 'test@uog.edu.et', github: 'https://github.com/gechkibr', avatar: '👨‍💻' },
  { name: 'student', role: 'Backend Developer', email: 'test@uog.edu.et', github: 'https://github.com/gechkibr', avatar: '🧑‍💻' },
  { name: 'student', role: 'Frontend Developer', email: 'test@uog.edu.et', github: 'https://github.com/gechkibr', avatar: '👩‍💻' },
  { name: 'student', role: 'Backend Developer', email: 'test@uog.edu.et', github: 'https://github.com/gechkibr', avatar: '🧑‍💻' },
  { name: 'student', role: 'Frontend Developer', email: 'test@uog.edu.et', github: 'https://github.com/gechkibr', avatar: '👩‍💻' },
];

const LandingPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null); // 'success' | 'error' | null
  const [contactLoading, setContactLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementComments, setAnnouncementComments] = useState({});
  const [expandedAnnouncements, setExpandedAnnouncements] = useState({});
  const [newComments, setNewComments] = useState({});

  const storedUser = localStorage.getItem('user');
  let currentUser = null;
  try {
    currentUser = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    currentUser = null;
  }
  const isAuthenticated = !!localStorage.getItem('token') && !!currentUser;

  const loadAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const data = await apiService.getPublicAnnouncements();
      setAnnouncements(Array.isArray(data) ? data : data.results || []);
    } catch {
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleToggleLike = async (announcementId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      await apiService.toggleAnnouncementLike(announcementId);
      await loadAnnouncements();
    } catch {
      // noop
    }
  };

  const toggleComments = async (announcementId) => {
    const expanded = !!expandedAnnouncements[announcementId];
    setExpandedAnnouncements((prev) => ({ ...prev, [announcementId]: !expanded }));

    if (!expanded && !announcementComments[announcementId]) {
      try {
        const data = await apiService.getAnnouncementComments(announcementId);
        setAnnouncementComments((prev) => ({
          ...prev,
          [announcementId]: Array.isArray(data) ? data : data.results || [],
        }));
      } catch {
        setAnnouncementComments((prev) => ({ ...prev, [announcementId]: [] }));
      }
    }
  };

  const handleAddComment = async (announcementId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const message = (newComments[announcementId] || '').trim();
    if (!message) return;

    try {
      await apiService.addAnnouncementComment(announcementId, message);
      const data = await apiService.getAnnouncementComments(announcementId);
      setAnnouncementComments((prev) => ({
        ...prev,
        [announcementId]: Array.isArray(data) ? data : data.results || [],
      }));
      setNewComments((prev) => ({ ...prev, [announcementId]: '' }));
      await loadAnnouncements();
    } catch {
      // noop
    }
  };

  const handleContact = async (e) => {
    e.preventDefault();
    setContactLoading(true);
    setContactStatus(null);
    try {
      await apiService.sendContact(contactForm);
      setContactStatus('success');
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setContactStatus('error');
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className={`text-5xl md:text-7xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'} mb-6 leading-tight`}>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Complaint Management and feedback tracking platform  for UOG
              </span>
            </h1>

            <p className={`text-xl md:text-2xl ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-10 max-w-3xl mx-auto leading-relaxed`}>
              A comprehensive platform for educational institutions to manage, track, and resolve complaints efficiently with real-time analytics.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={() => navigate('/login')}
                className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all border-2 ${isDark
                  ? 'border-gray-600 text-white hover:bg-gray-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                Sign In
              </button>
            </div>


          </div>
        </div>
      </section>

      {/* Public Announcement Board */}
      <section id="announcements" className={`py-14 ${isDark ? 'bg-gray-800/60' : 'bg-blue-50/70'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Announcement Board
            </h2>
            <span className={`text-sm px-3 py-1 rounded-full ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-700'}`}>
              Posted by officers
            </span>
          </div>

          {announcementsLoading ? (
            <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Loading announcements...</p>
          ) : announcements.length === 0 ? (
            <div className={`rounded-xl p-6 border ${isDark ? 'bg-gray-900/40 border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600'}`}>
              No public announcements available right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-xl p-5 border shadow-sm ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.is_pinned ? '📌 ' : ''}
                      {item.title}
                    </h3>
                    {item.is_pinned && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Pinned</span>
                    )}
                  </div>
                  <p className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.message}</p>
                  <p className={`mt-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    By {item.created_by_name} | {new Date(item.created_at).toLocaleString()}
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(item.id)}
                      className={`px-3 py-1 text-sm rounded-lg border transition-colors ${item.liked_by_user
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : isDark
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      ❤ {item.likes_count || 0}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleComments(item.id)}
                      className={`px-3 py-1 text-sm rounded-lg border transition-colors ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      💬 {item.comments_count || 0}
                    </button>
                  </div>

                  {expandedAnnouncements[item.id] && (
                    <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(announcementComments[item.id] || []).length === 0 ? (
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            No comments yet.
                          </p>
                        ) : (
                          (announcementComments[item.id] || []).map((comment) => (
                            <div key={comment.id} className={`rounded p-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                              <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{comment.message}</p>
                              <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {comment.user_name} | {new Date(comment.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={newComments[item.id] || ''}
                          onChange={(e) => setNewComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder={isAuthenticated ? 'Write a comment...' : 'Sign in to comment'}
                          disabled={!isAuthenticated}
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg ${isDark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(item.id)}
                          disabled={!isAuthenticated || !(newComments[item.id] || '').trim()}
                          className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className={`py-20 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Meet the Developers</h2>
            <p className={`mt-3 text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Built with University of Gondar</p>
          </div>

          {/* Developer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {developers.map(dev => (
              <div key={dev.name} className={`rounded-xl p-6 text-center shadow-md ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="text-5xl mb-3">{dev.avatar}</div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{dev.name}</h3>
                <p className="text-blue-500 text-sm font-medium mb-2">{dev.role}</p>
                <a href={`mailto:${dev.email}`} className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} hover:text-blue-500`}>{dev.email}</a>
                <div className="mt-3">
                  <a href={dev.github} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    GitHub →
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Contact Form */}
          <div className="max-w-2xl mx-auto">
            <h3 className={`text-2xl font-bold text-center mb-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>Send Us a Message</h3>
            <form onSubmit={handleContact} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Name *</label>
                  <input required type="text" value={contactForm.name}
                    onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email *</label>
                  <input required type="email" value={contactForm.email}
                    onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Subject *</label>
                <input required type="text" value={contactForm.subject}
                  onChange={e => setContactForm(p => ({ ...p, subject: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Message *</label>
                <textarea required rows={5} value={contactForm.message}
                  onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
              </div>
              {contactStatus === 'success' && (
                <p className="text-green-500 text-sm font-medium">✅ Message sent successfully! We'll get back to you soon.</p>
              )}
              {contactStatus === 'error' && (
                <p className="text-red-500 text-sm font-medium">❌ Failed to send message. Please try again.</p>
              )}
              <button type="submit" disabled={contactLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60">
                {contactLoading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default LandingPage;
