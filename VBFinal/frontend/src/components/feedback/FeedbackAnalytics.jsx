import React, { useCallback, useEffect, useState } from 'react';
import apiService from '../../services/api';

const FeedbackAnalytics = ({ templateId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    campus: '',
    college: '',
    department: '',
    role: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({});

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  const canUseAnalyticsFilters = currentUser?.role === 'admin' || currentUser?.role === 'officer';

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getFeedbackTemplateAnalytics(templateId, appliedFilters);
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [templateId, appliedFilters]);

  useEffect(() => {
    const loadCampuses = async () => {
      if (!canUseAnalyticsFilters) return;
      try {
        const data = await apiService.getCampuses();
        setCampuses(data?.results || data || []);
      } catch (error) {
        console.error('Error loading campuses:', error);
        setCampuses([]);
      }
    };

    loadCampuses();
  }, [canUseAnalyticsFilters]);

  useEffect(() => {
    const loadColleges = async () => {
      if (!canUseAnalyticsFilters) return;
      try {
        const data = await apiService.getColleges(filters.campus || null);
        setColleges(data?.results || data || []);
      } catch (error) {
        console.error('Error loading colleges:', error);
        setColleges([]);
      }
    };

    loadColleges();
  }, [filters.campus, canUseAnalyticsFilters]);

  useEffect(() => {
    const loadDepartments = async () => {
      if (!canUseAnalyticsFilters) return;
      try {
        const data = await apiService.getDepartments(filters.college || null);
        setDepartments(data?.results || data || []);
      } catch (error) {
        console.error('Error loading departments:', error);
        setDepartments([]);
      }
    };

    loadDepartments();
  }, [filters.college, canUseAnalyticsFilters]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    if (name === 'campus') {
      setFilters((prev) => ({ ...prev, campus: value, college: '', department: '' }));
      return;
    }

    if (name === 'college') {
      setFilters((prev) => ({ ...prev, college: value, department: '' }));
      return;
    }

    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    const nextFilters = {};
    if (filters.campus) nextFilters.campus = filters.campus;
    if (filters.college) nextFilters.college = filters.college;
    if (filters.department) nextFilters.department = filters.department;
    if (filters.role) nextFilters.role = filters.role;
    setAppliedFilters(nextFilters);
  };

  const clearFilters = () => {
    const cleared = { campus: '', college: '', department: '', role: '' };
    setFilters(cleared);
    setAppliedFilters({});
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) return <div className="text-center py-10 text-lg text-gray-600">Loading analytics...</div>;
  if (!analytics) return <div className="text-center py-10 text-lg text-red-600">Failed to load analytics</div>;

  return (
    <div className="max-w-6xl mx-auto p-5">
      {canUseAnalyticsFilters && (
        <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Analytics Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              name="campus"
              value={filters.campus}
              onChange={handleFilterChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Campuses</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>{campus.campus_name}</option>
              ))}
            </select>

            <select
              name="college"
              value={filters.college}
              onChange={handleFilterChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Colleges</option>
              {colleges.map((college) => (
                <option key={college.id} value={college.id}>{college.college_name}</option>
              ))}
            </select>

            <select
              name="department"
              value={filters.department}
              onChange={handleFilterChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.department_name}</option>
              ))}
            </select>

            <select
              name="role"
              value={filters.role}
              onChange={handleFilterChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="officer">Officer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8 p-5 bg-white rounded-lg shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800 m-0">Feedback Analytics</h2>
        <div className="text-center">
          <span className="block text-4xl font-bold text-blue-500">{analytics?.total_responses || 0}</span>
          <span className="text-sm text-gray-600">Total Responses</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {analytics?.field_analytics && Object.entries(analytics.field_analytics).map(([fieldName, data]) => (
          <div key={fieldName} className="bg-white p-5 rounded-lg shadow-sm">
            <h3 className="text-base font-semibold text-gray-800 mb-4">{fieldName}</h3>
            <FieldAnalytics data={data} />
          </div>
        ))}
      </div>

      {analytics.response_trend && analytics.response_trend.length > 0 && (
        <div className="bg-white p-5 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-5">Response Trend (Last 30 Days)</h3>
          <div className="flex items-end gap-2 h-48 p-3 overflow-x-auto">
            {analytics.response_trend.map((item, index) => (
              <div key={index} className="flex flex-col items-center min-w-16">
                <div
                  className="w-5 bg-blue-500 rounded-t mb-2 min-h-1"
                  style={{
                    height: `${(item.count / Math.max(...analytics.response_trend.map(t => t.count))) * 100}%`
                  }}
                />
                <span className="text-xs text-gray-600 text-center mb-1">{new Date(item.day).toLocaleDateString()}</span>
                <span className="text-xs font-semibold text-gray-800">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FieldAnalytics = ({ data }) => {
  switch (data.type) {
    case 'rating':
      return (
        <div className="text-center">
          <div className="mb-3">
            <span className="block text-3xl font-bold text-yellow-500 mb-1">{data.average}</span>
            <div className="text-xl">
              {[1, 2, 3, 4, 5].map(star => (
                <span
                  key={star}
                  className={star <= Math.round(data.average) ? 'opacity-100' : 'opacity-30'}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
          <p className="text-gray-600">{data.count} responses</p>
        </div>
      );

    case 'choice':
      return (
        <div className="flex flex-col gap-3">
          {data.choices.map((choice, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="flex-none w-32 text-sm text-gray-800">{choice.choice_value}</span>
              <div className="flex-1 relative h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(choice.count / Math.max(...data.choices.map(c => c.count))) * 100}%`
                  }}
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-semibold text-gray-800">
                  {choice.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      );

    case 'number':
      return (
        <div className="text-center">
          <div className="mb-2">
            <span className="block text-3xl font-bold text-green-500 mb-1">{data.average}</span>
            <span className="text-sm text-gray-600">Average</span>
          </div>
          <p className="text-gray-600">{data.count} responses</p>
        </div>
      );

    default:
      return (
        <div className="text-center text-gray-600">
          <p>{data.count} responses</p>
        </div>
      );
  }
};

export default FeedbackAnalytics;
