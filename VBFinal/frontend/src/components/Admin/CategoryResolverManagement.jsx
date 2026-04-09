import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const BackButton = ({ isDark, onClick, label = 'Back' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
  >
    <span>←</span>
    <span>{label}</span>
  </button>
);

const CategoryResolverManagement = () => {
  const { isDark } = useTheme();
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [filteredResolvers, setFilteredResolvers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [resolverLevels, setResolverLevels] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingResolver, setEditingResolver] = useState(null);
  const [pageMode, setPageMode] = useState('home');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    search: ''
  });
  const [formData, setFormData] = useState({
    category: '',
    level: '',
    officer: '',
    escalation_time: '2 00:00:00',
    active: true
  });

  const resetForm = () => setFormData({ category: '', level: '', officer: '', escalation_time: '2 00:00:00', active: true });

  const openHomePage = () => setPageMode('home');
  const openViewPage = () => setPageMode('view');
  const openCreatePage = () => {
    setEditingResolver(null);
    resetForm();
    setPageMode('add');
  };

  const applyFilters = useCallback(() => {
    let filtered = categoryResolvers;

    if (filters.category !== 'all') {
      filtered = filtered.filter(r => r.category === filters.category);
    }

    if (filters.status !== 'all') {
      const isActive = filters.status === 'active';
      filtered = filtered.filter(r => r.active === isActive);
    }

    if (filters.search) {
      filtered = filtered.filter(r =>
        r.category_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.officer_name?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Update pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
    const currentPage = Math.min(pagination.currentPage, totalPages || 1);

    setPagination(prev => ({
      ...prev,
      totalItems,
      totalPages,
      currentPage
    }));

    // Apply pagination
    const startIndex = (currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    const paginatedData = filtered.slice(startIndex, endIndex);

    setFilteredResolvers(paginatedData);
  }, [categoryResolvers, filters, pagination.currentPage, pagination.itemsPerPage]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const loadData = useCallback(async () => {
    try {
      const [resolversData, levelsData, usersData] = await Promise.all([
        apiService.getAllCategoryResolvers(),
        apiService.getResolverLevels(),
        apiService.getAllUsers()
      ]);
      setCategoryResolvers(resolversData.results || resolversData);
      setResolverLevels(levelsData.results || levelsData);
      setUsers(usersData.results || usersData);

      // Load all categories separately
      await loadAllCategories();
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadAllCategories = async () => {
    try {
      let allCategories = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await apiService.getCategories(page);
        if (response.results) {
          allCategories = [...allCategories, ...response.results];
          hasMore = !!response.next;
        } else if (Array.isArray(response)) {
          allCategories = response;
          hasMore = false;
        } else {
          hasMore = false;
        }
        page++;
      }

      setCategories(allCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingResolver) {
        await apiService.updateCategoryResolver(editingResolver.id, formData);
      } else {
        await apiService.createCategoryResolver(formData);
      }
      setEditingResolver(null);
      resetForm();
      setPageMode('view');
      await loadData();
    } catch (error) {
      console.error('Failed to save category resolver:', error);
    }
  };

  const handleEdit = (resolver) => {
    setEditingResolver(resolver);
    setFormData({
      category: resolver.category,
      level: resolver.level,
      officer: resolver.officer,
      escalation_time: resolver.escalation_time || '2 00:00:00',
      active: resolver.active
    });
    setPageMode('edit');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        await apiService.deleteCategoryResolver(id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete category resolver:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {pageMode === 'home' && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Category Resolver Assignments</h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Choose whether to view assignments or create a new one.</p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={openViewPage} className="px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">View Assignments</button>
            <button onClick={openCreatePage} className={`px-4 py-3 rounded-lg border font-medium ${isDark ? 'border-gray-600 text-gray-100 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Add Assignment</button>
          </div>
        </div>
      )}

      {(pageMode === 'view' || pageMode === 'home') && pageMode !== 'home' && (
        <div className="space-y-6">
          <BackButton isDark={isDark} onClick={openHomePage} />
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h3 className="text-lg font-semibold text-gray-700">Category Resolver Assignments</h3>
            <button onClick={openCreatePage} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full sm:w-auto">Add Assignment</button>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>Search</label>
                <input
                  type="text"
                  placeholder="Search category or officer..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id || cat.category_id} value={cat.id || cat.category_id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>Per Page</label>
                <select
                  value={pagination.itemsPerPage}
                  onChange={(e) => setPagination(prev => ({ ...prev, itemsPerPage: parseInt(e.target.value), currentPage: 1 }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ category: 'all', status: 'all', search: '' })}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Officer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Escalation Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredResolvers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      {filters.search || filters.category !== 'all' || filters.status !== 'all'
                        ? 'No assignments match the current filters.'
                        : 'No category resolver assignments found.'}
                    </td>
                  </tr>
                ) : (
                  filteredResolvers.map((resolver) => (
                    <tr key={resolver.id}>
                      <td className="px-6 py-4 text-sm text-neutral">{resolver.category_name}</td>
                      <td className="px-6 py-4 text-sm text-neutral">{resolver.level_name}</td>
                      <td className="px-6 py-4 text-sm text-neutral">{resolver.officer_name}</td>
                      <td className="px-6 py-4 text-sm text-neutral">{resolver.escalation_time || '—'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${resolver.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {resolver.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleEdit(resolver)}
                          className="text-primary hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(resolver.id)}
                          className="text-error hover:text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-white px-6 py-3 border-t border-gray-200 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
                  {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
                  {pagination.totalItems} results
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                    disabled={pagination.currentPage === 1}
                    className={`px-3 py-1 rounded text-sm ${pagination.currentPage === 1
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                  >
                    Previous
                  </button>

                  {[...Array(pagination.totalPages)].map((_, index) => {
                    const page = index + 1;
                    if (
                      page === 1 ||
                      page === pagination.totalPages ||
                      (page >= pagination.currentPage - 1 && page <= pagination.currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setPagination(prev => ({ ...prev, currentPage: page }))}
                          className={`px-3 py-1 rounded text-sm ${page === pagination.currentPage
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === pagination.currentPage - 2 ||
                      page === pagination.currentPage + 2
                    ) {
                      return <span key={page} className="px-2">...</span>;
                    }
                    return null;
                  })}

                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className={`px-3 py-1 rounded text-sm ${pagination.currentPage === pagination.totalPages
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(pageMode === 'add' || pageMode === 'edit') && (
        <div className="space-y-4">
          <BackButton isDark={isDark} onClick={openHomePage} />
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{editingResolver ? 'Edit Assignment' : 'Add Assignment'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id || cat.category_id} value={cat.id || cat.category_id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Resolver Level</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  required
                >
                  <option value="">Select Level</option>
                  {resolverLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.institution_name} - {level.name} (Level {level.level_order})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Officer</label>
                <select
                  value={formData.officer}
                  onChange={(e) => setFormData({ ...formData, officer: e.target.value })}
                  className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  required
                >
                  <option value="">Select Officer</option>
                  {users.filter(user => user.role === 'officer' || user.is_staff).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Escalation Time</label>
                <input
                  type="text"
                  value={formData.escalation_time}
                  onChange={(e) => setFormData({ ...formData, escalation_time: e.target.value })}
                  className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  placeholder="e.g. 2 00:00:00"
                  required
                />
                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Use Django duration format: D HH:MM:SS (example: 2 00:00:00 for 2 days)
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="mr-2"
                  />
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Active</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={openHomePage}
                  className={`px-4 py-2 border rounded-md transition-colors ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-800"
                >
                  {editingResolver ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryResolverManagement;
