import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const UserProfile = ({ user: propUser }) => {
  const { isDark } = useTheme();
  const { user: authUser, setAuth } = useAuth();
  const user = propUser || authUser;
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Campus, College, Department data
  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [, setFetchingData] = useState(true);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirm_password: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    username: user?.username || '',
    gmail_account: user?.gmail_account || '',
    campus_id: user?.campus_id || '',
    user_campus: user?.user_campus || null,
    college: user?.college || null,
    department: user?.department || null,
    phone: user?.phone || ''
  });

  // Fetch campuses on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setFetchingData(true);
        // Fetch all campuses
        const campusesData = await apiService.getCampuses();
        const campusList = Array.isArray(campusesData) ? campusesData : campusesData.results || [];
        setCampuses(campusList);

        // If user has a campus, fetch colleges for that campus
        if (user?.user_campus) {
          const collegesData = await apiService.getColleges(user.user_campus);
          const collegesList = Array.isArray(collegesData) ? collegesData : collegesData.results || [];
          setColleges(collegesList);

          // If user has a college, fetch departments for that college
          if (user?.college) {
            const departmentsData = await apiService.getDepartments(user.college);
            const departmentsList = Array.isArray(departmentsData) ? departmentsData : departmentsData.results || [];
            setDepartments(departmentsList);
          }
        }
      } catch (error) {
        console.error('Failed to fetch campus/college/department data:', error);
      } finally {
        setFetchingData(false);
      }
    };

    fetchData();
  }, [user?.user_campus, user?.college]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCampusChange = async (e) => {
    const campusId = e.target.value ? parseInt(e.target.value) : null;
    setFormData(prev => ({
      ...prev,
      user_campus: campusId,
      college: null,
      department: null
    }));

    // Fetch colleges for selected campus
    if (campusId) {
      try {
        const collegesData = await apiService.getColleges(campusId);
        const collegesList = Array.isArray(collegesData) ? collegesData : collegesData.results || [];
        setColleges(collegesList);
      } catch (error) {
        console.error('Failed to fetch colleges:', error);
        setColleges([]);
      }
    } else {
      setColleges([]);
    }
    setDepartments([]);
  };

  const handleCollegeChange = async (e) => {
    const collegeId = e.target.value ? parseInt(e.target.value) : null;
    setFormData(prev => ({
      ...prev,
      college: collegeId,
      department: null
    }));

    // Fetch departments for selected college
    if (collegeId) {
      try {
        const departmentsData = await apiService.getDepartments(collegeId);
        const departmentsList = Array.isArray(departmentsData) ? departmentsData : departmentsData.results || [];
        setDepartments(departmentsList);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
        setDepartments([]);
      }
    } else {
      setDepartments([]);
    }
  };

  const handleDepartmentChange = (e) => {
    const departmentId = e.target.value ? parseInt(e.target.value) : null;
    setFormData(prev => ({
      ...prev,
      department: departmentId
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        gmail_account: formData.gmail_account?.trim() ? formData.gmail_account.trim().toLowerCase() : null,
        campus_id: formData.campus_id,
        user_campus: formData.user_campus,
        college: formData.college,
        department: formData.department,
        phone: formData.phone
      };

      await apiService.updateUser(user.id, updateData);

      const updatedUser = { ...user, ...updateData };
      setAuth(updatedUser);

      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      username: user?.username || '',
      gmail_account: user?.gmail_account || '',
      campus_id: user?.campus_id || '',
      user_campus: user?.user_campus || null,
      college: user?.college || null,
      department: user?.department || null,
      phone: user?.phone || ''
    });
    setIsEditing(false);
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.password !== passwordData.confirm_password) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (passwordData.password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      await apiService.updateUser(user.id, {
        password: passwordData.password,
        confirm_password: passwordData.confirm_password
      });
      setPasswordSuccess('Password updated successfully');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordData({ password: '', confirm_password: '' });
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const getCampusName = (campusId) => {
    if (!campusId) return 'Not specified';
    const campus = campuses.find(c => c.id === campusId);
    return campus?.campus_name || 'Unknown Campus';
  };

  const getCollegeName = (collegeId) => {
    if (!collegeId) return 'Not specified';
    const college = colleges.find(c => c.id === collegeId);
    return college?.college_name || 'Unknown College';
  };

  const getDepartmentName = (deptId) => {
    if (!deptId) return 'Not specified';
    const dept = departments.find(d => d.id === deptId);
    return dept?.department_name || 'Unknown Department';
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowPasswordModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className={`inline-block align-bottom rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className={`text-lg leading-6 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`} id="modal-title">
                      Change Password
                    </h3>
                    <div className="mt-4">
                      {passwordError && (
                        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                          <span className="block sm:inline">{passwordError}</span>
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
                          <span className="block sm:inline">{passwordSuccess}</span>
                        </div>
                      )}
                      <form onSubmit={submitPasswordChange} className="space-y-4">
                        <div>
                          <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            New Password
                          </label>
                          <input
                            type="password"
                            name="password"
                            value={passwordData.password}
                            onChange={handlePasswordChange}
                            className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Confirm Password
                          </label>
                          <input
                            type="password"
                            name="confirm_password"
                            value={passwordData.confirm_password}
                            onChange={handlePasswordChange}
                            className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                          />
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse ${isDark ? 'bg-gray-700' : ''}`}>
                <button
                  type="button"
                  onClick={submitPasswordChange}
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className={`mt-3 w-full inline-flex justify-center rounded-md border shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm ${isDark ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 border-gray-500' : 'border-gray-300'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex justify-between items-center`}>
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Profile Settings
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
              Manage your account information and preferences
            </p>
          </div>
          <div className="flex space-x-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Change Password
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Profile
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center mb-6">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {(formData.first_name?.charAt(0) || user?.first_name?.charAt(0) || '').toUpperCase()}
              {(formData.last_name?.charAt(0) || user?.last_name?.charAt(0) || '').toUpperCase()}
            </div>
            <div className="ml-6">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formData.first_name || user?.first_name} {formData.last_name || user?.last_name}
              </h4>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {user?.email}
              </p>
              <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${user?.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                user?.role === 'officer' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Campus ID
              </label>
              <input
                type="text"
                name="campus_id"
                value={formData.campus_id}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>

            <div className="md:col-span-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Email cannot be changed. Contact admin if needed.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Gmail Account (Reset + Notifications)
              </label>
              <input
                type="email"
                name="gmail_account"
                value={formData.gmail_account || ''}
                onChange={handleInputChange}
                readOnly={!isEditing}
                placeholder={isEditing ? 'example@gmail.com' : 'Not provided'}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Must be a valid @gmail.com address.
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Campus
              </label>
              {isEditing ? (
                <select
                  value={formData.user_campus || ''}
                  onChange={handleCampusChange}
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                >
                  <option value="">Select Campus</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.campus_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={getCampusName(user?.user_campus)}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
                />
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                College
              </label>
              {isEditing ? (
                <select
                  value={formData.college || ''}
                  onChange={handleCollegeChange}
                  disabled={!formData.user_campus}
                  className={`w-full px-3 py-2 border rounded-lg ${!formData.user_campus
                      ? isDark ? 'bg-gray-600 border-gray-600 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'
                      : isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                >
                  <option value="">Select College</option>
                  {colleges.map(college => (
                    <option key={college.id} value={college.id}>
                      {college.college_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={getCollegeName(user?.college)}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
                />
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Department
              </label>
              {isEditing ? (
                <select
                  value={formData.department || ''}
                  onChange={handleDepartmentChange}
                  disabled={!formData.college}
                  className={`w-full px-3 py-2 border rounded-lg ${!formData.college
                      ? isDark ? 'bg-gray-600 border-gray-600 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'
                      : isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={getDepartmentName(user?.department)}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
                />
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                readOnly={!isEditing}
                placeholder={isEditing ? "Enter phone number" : "Not provided"}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>
          </div>

          <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-blue-50'} border ${isDark ? 'border-gray-600' : 'border-blue-200'}`}>
            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-blue-900'} mb-2`}>
              📝 Profile Information
            </h4>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-blue-800'}`}>
              {isEditing
                ? 'You can edit your personal information. Email address cannot be changed for security reasons.'
                : 'Click "Edit Profile" to update your personal information. Some fields may require admin approval.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
