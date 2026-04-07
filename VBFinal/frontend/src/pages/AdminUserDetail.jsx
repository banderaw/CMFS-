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

const getRoleLabel = (code) => {
  if (!code) return 'Unknown';
  return code.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const AdminUserDetail = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { logout } = useAuth();
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    gmail_account: '',
    phone: '',
    campus_id: '',
    user_campus: '',
    college: '',
    department: '',
    role: 'user',
    is_active: true,
  });

  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getAllUsers();
      const usersList = data.results || data || [];
      const matchedUser = usersList.find((item) => String(item.id) === String(userId));

      if (!matchedUser) {
        throw new Error('User not found');
      }

      setUser(matchedUser);
      setFormData({
        first_name: matchedUser.first_name || '',
        last_name: matchedUser.last_name || '',
        username: matchedUser.username || '',
        email: matchedUser.email || '',
        gmail_account: matchedUser.gmail_account || '',
        phone: matchedUser.phone || '',
        campus_id: matchedUser.campus_id || '',
        user_campus: matchedUser.user_campus || '',
        college: matchedUser.college || '',
        department: matchedUser.department || '',
        role: matchedUser.role || 'user',
        is_active: Boolean(matchedUser.is_active),
      });
    } catch (error) {
      console.error('Failed to load user:', error);
      window.alert('Failed to load user details');
      navigate('/admin?tab=users');
    } finally {
      setLoading(false);
    }
  }, [navigate, userId]);

  useEffect(() => {
    if (!userId) {
      navigate('/admin?tab=users');
      return;
    }

    loadUser();
    Promise.all([
      apiService.getCampuses(),
      apiService.getColleges(),
      apiService.getDepartments(),
    ])
      .then(([campusesData, collegesData, departmentsData]) => {
        setCampuses(campusesData.results ?? campusesData ?? []);
        setColleges(collegesData.results ?? collegesData ?? []);
        setDepartments(departmentsData.results ?? departmentsData ?? []);
      })
      .catch((error) => {
        console.error('Failed to load user dependencies:', error);
      });
  }, [loadUser, navigate, userId]);

  const filteredColleges = useMemo(() => (
    formData.user_campus
      ? colleges.filter((college) => String(college.college_campus) === String(formData.user_campus))
      : colleges
  ), [colleges, formData.user_campus]);

  const filteredDepartments = useMemo(() => (
    formData.college
      ? departments.filter((department) => String(department.department_college) === String(formData.college))
      : departments
  ), [departments, formData.college]);

  const handleSidebarToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarCollapsed((prev) => !prev);
      return;
    }
    setSidebarOpen((prev) => !prev);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        username: formData.username || null,
        gmail_account: formData.gmail_account || null,
        phone: formData.phone || null,
        campus_id: formData.campus_id || null,
        user_campus: formData.user_campus || null,
        college: formData.college || null,
        department: formData.department || null,
      };

      await apiService.updateUser(user.id, payload);
      window.alert('User updated successfully');
      navigate('/admin?tab=users');
    } catch (error) {
      console.error('Failed to update user:', error);
      window.alert('Failed to update user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteUser(user.id);
      window.alert('User deleted successfully');
      navigate('/admin?tab=users');
    } catch (error) {
      console.error('Failed to delete user:', error);
      window.alert('Failed to delete user');
    }
  };

  const toggleUserStatus = async () => {
    if (!user) return;

    try {
      const nextStatus = !user.is_active;
      await apiService.updateUser(user.id, { is_active: nextStatus });
      setUser((prev) => ({ ...prev, is_active: nextStatus }));
      setFormData((prev) => ({ ...prev, is_active: nextStatus }));
    } catch (error) {
      console.error('Failed to update status:', error);
      window.alert('Failed to update user status');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="text-lg text-gray-500">Loading user details...</div>
        </div>
      </div>
    );
  }

  if (!user) {
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
          activeItem="users"
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
                onClick={() => navigate('/admin?tab=users')}
                className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Back to Users
              </button>
              <div className="flex items-center gap-2">
                <button onClick={loadUser} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">
                  Refresh
                </button>
                <button onClick={handleDelete} className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700">
                  Delete
                </button>
              </div>
            </div>

            <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
              <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {user.first_name} {user.last_name}
              </h2>
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : user.role === 'officer' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                  {getRoleLabel(user.role)}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email:</span><span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{user.email}</span></div>
                <div><span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Username:</span><span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{user.username || 'N/A'}</span></div>
                <div><span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Joined:</span><span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{user.date_joined ? new Date(user.date_joined).toLocaleString() : 'N/A'}</span></div>
                <div><span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Auth Provider:</span><span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{user.auth_provider || 'local'}</span></div>
              </div>
            </section>

            <section className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Edit User</h3>
                <button
                  onClick={toggleUserStatus}
                  className={`px-3 py-2 rounded text-sm ${formData.is_active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                >
                  {formData.is_active ? 'Deactivate User' : 'Activate User'}
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>First Name</label>
                    <input name="first_name" value={formData.first_name} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Last Name</label>
                    <input name="last_name" value={formData.last_name} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Username</label>
                    <input name="username" value={formData.username} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Gmail Account</label>
                    <input name="gmail_account" type="email" value={formData.gmail_account} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                  <input name="email" type="email" value={formData.email} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Phone</label>
                    <input name="phone" value={formData.phone} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Campus ID</label>
                    <input name="campus_id" value={formData.campus_id} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Campus</label>
                    <select name="user_campus" value={formData.user_campus} onChange={(e) => setFormData((prev) => ({ ...prev, user_campus: e.target.value, college: '', department: '' }))} className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                      <option value="">Select Campus</option>
                      {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.campus_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>College</label>
                    <select name="college" value={formData.college} onChange={(e) => setFormData((prev) => ({ ...prev, college: e.target.value, department: '' }))} className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                      <option value="">Select College</option>
                      {filteredColleges.map((college) => <option key={college.id} value={college.id}>{college.college_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Department</label>
                    <select name="department" value={formData.department} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                      <option value="">Select Department</option>
                      {filteredDepartments.map((department) => <option key={department.id} value={department.id}>{department.department_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Role</label>
                    <select name="role" value={formData.role} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                      {['user', 'officer', 'admin'].map((roleCode) => <option key={roleCode} value={roleCode}>{getRoleLabel(roleCode)}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center">
                      <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="mr-2" />
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Active User</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button type="button" onClick={() => navigate('/admin?tab=users')} className={`px-4 py-2 border rounded-md ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminUserDetail;