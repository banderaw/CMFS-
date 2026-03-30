import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PublicNavbar from '../components/UI/PublicNavbar';
import PublicFooter from '../components/UI/PublicFooter';

const API = import.meta.env.VITE_API_URL || '/api';

const RegisterComplete = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark } = useTheme();
  const { setAuth } = useAuth();

  const email = searchParams.get('email');
  const firstName = searchParams.get('first_name') || '';
  const lastName = searchParams.get('last_name') || '';
  const accessToken = searchParams.get('access');
  const refreshToken = searchParams.get('refresh');

  const [formData, setFormData] = useState({
    first_name: firstName,
    last_name: lastName,
    gmail_account: '',
    campus_id: '',
    phone: '',
    user_campus: '',
    college: '',
    department: '',
    password: '',
    confirm_password: '',
  });

  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refresh', refreshToken);
    }
    fetch(`${API}/campuses/`).then(r => r.json()).then(setCampuses).catch(() => {});
  }, [accessToken, refreshToken]);

  useEffect(() => {
    if (!formData.user_campus) { setColleges([]); setDepartments([]); return; }
    setFormData(prev => ({ ...prev, college: '', department: '' }));
    setDepartments([]);
    fetch(`${API}/colleges/?campus=${formData.user_campus}`)
      .then(r => r.json()).then(setColleges).catch(() => {});
  }, [formData.user_campus]);

  useEffect(() => {
    if (!formData.college) { setDepartments([]); return; }
    setFormData(prev => ({ ...prev, department: '' }));
    fetch(`${API}/departments/?college=${formData.college}`)
      .then(r => r.json()).then(setDepartments).catch(() => {});
  }, [formData.college]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.campus_id || !formData.user_campus || !formData.college) {
      setError('Please fill in all required fields marked with *');
      return;
    }

    if (formData.password || formData.confirm_password) {
      if (formData.password !== formData.confirm_password) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        campus_id: formData.campus_id,
        user_campus: formData.user_campus,
        college: formData.college,
      };
      if (formData.department) payload.department = formData.department;
      if (formData.phone?.trim()) payload.phone = formData.phone;
      if (formData.gmail_account?.trim()) payload.gmail_account = formData.gmail_account.trim().toLowerCase();
      if (formData.first_name && formData.first_name !== firstName) payload.first_name = formData.first_name;
      if (formData.last_name && formData.last_name !== lastName) payload.last_name = formData.last_name;
      if (formData.password) {
        payload.password = formData.password;
        payload.confirm_password = formData.confirm_password;
      }

      const response = await fetch('/api/accounts/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const userData = await response.json();
        localStorage.setItem('user', JSON.stringify(userData));
        setAuth(userData, token);
        setSuccess('Profile updated successfully! Redirecting...');
        setTimeout(() => {
          const role = userData.role;
          if (role === 'admin') navigate('/admin');
          else if (role === 'officer') navigate('/officer');
          else navigate('/user');
        }, 1500);
      } else {
        const data = await response.json();
        if (data.detail) {
          setError(data.detail);
        } else {
          const msgs = Object.entries(data)
            .map(([k, v]) => `${k.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('. ');
          setError(msgs || 'Failed to update profile. Please try again.');
        }
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = `mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
    isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'
  }`;
  const labelCls = `block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PublicNavbar />

      <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-8 rounded-2xl shadow-2xl border`}>
            <div className="text-center mb-8">
              <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>Complete Registration</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Welcome {firstName} {lastName}! Please provide a few details to finish setting up your account.
              </p>
            </div>

            {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}
            {success && <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Name *</label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className={inputCls} />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="email" value={email} disabled
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'}`}
                />
                <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Authenticated via Microsoft</p>
              </div>

              {/* Campus ID + Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Campus ID *</label>
                  <input type="text" name="campus_id" required value={formData.campus_id} onChange={handleChange}
                    placeholder="UoG/..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                    placeholder="+251..." className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Gmail Account (for reset + notifications)</label>
                <input
                  type="email"
                  name="gmail_account"
                  value={formData.gmail_account}
                  onChange={handleChange}
                  placeholder="example@gmail.com"
                  className={inputCls}
                />
              </div>

              {/* Campus */}
              <div>
                <label className={labelCls}>Campus *</label>
                <select name="user_campus" value={formData.user_campus} onChange={handleChange} required className={inputCls}>
                  <option value="">Select your campus</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.campus_name}</option>
                  ))}
                </select>
              </div>

              {/* College */}
              <div>
                <label className={labelCls}>College / Institute *</label>
                <select name="college" value={formData.college} onChange={handleChange} required disabled={!formData.user_campus} className={inputCls}>
                  <option value="">{formData.user_campus ? 'Select your college' : 'Select a campus first'}</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.college_name}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className={labelCls}>Department</label>
                <select name="department" value={formData.department} onChange={handleChange} disabled={!formData.college} className={inputCls}>
                  <option value="">{formData.college ? 'Select your department (optional)' : 'Select a college first'}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.department_name}</option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>New Password</label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange}
                    placeholder="Optional" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Confirm Password</label>
                  <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange}
                    placeholder="Optional" className={inputCls} />
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <span className="font-semibold">Note:</span> Setting a password is optional if you want to sign in with email/password later. You can always sign in with your Microsoft account.
                </p>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl">
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Completing Registration...
                  </div>
                ) : 'Complete Registration'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
};

export default RegisterComplete;
