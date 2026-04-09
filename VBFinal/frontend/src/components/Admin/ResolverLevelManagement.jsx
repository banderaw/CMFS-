import React, { useState, useEffect } from 'react';
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

const ResolverLevelManagement = () => {
  const { isDark } = useTheme();
  const [resolverLevels, setResolverLevels] = useState([]);
  const [editingLevel, setEditingLevel] = useState(null);
  const [pageMode, setPageMode] = useState('home');
  const [formData, setFormData] = useState({
    name: '',
    level_order: ''
  });

  const resetForm = () => setFormData({ name: '', level_order: '' });
  const openHomePage = () => setPageMode('home');
  const openViewPage = () => setPageMode('view');
  const openCreatePage = () => {
    setEditingLevel(null);
    resetForm();
    setPageMode('add');
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const levelsData = await apiService.getResolverLevels();
      setResolverLevels(levelsData.results || levelsData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLevel) {
        await apiService.updateResolverLevel(editingLevel.id, formData);
      } else {
        await apiService.createResolverLevel(formData);
      }
      setEditingLevel(null);
      resetForm();
      setPageMode('view');
      loadData();
    } catch (error) {
      console.error('Failed to save resolver level:', error);
    }
  };

  const handleEdit = (level) => {
    setEditingLevel(level);
    setFormData({
      name: level.name,
      level_order: level.level_order
    });
    setPageMode('edit');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this resolver level?')) {
      try {
        await apiService.deleteResolverLevel(id);
        loadData();
      } catch (error) {
        console.error('Failed to delete resolver level:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {pageMode === 'home' && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Resolver Level Management</h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Choose to view resolver levels or add a new level.</p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={openViewPage} className="px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">View Resolver Levels</button>
            <button onClick={openCreatePage} className={`px-4 py-3 rounded-lg border font-medium ${isDark ? 'border-gray-600 text-gray-100 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Add Resolver Level</button>
          </div>
        </div>
      )}

      {pageMode === 'view' && (
        <div className="space-y-4">
          <BackButton isDark={isDark} onClick={openHomePage} />
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-700">Resolver Level Management</h3>
            <button onClick={openCreatePage} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Add Resolver Level</button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(resolverLevels || []).length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-center text-gray-500">
                      No resolver levels found. Click "Add Resolver Level" to create one.
                    </td>
                  </tr>
                ) : (
                  (resolverLevels || []).map((level) => (
                    <tr key={level.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{level.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">Level {level.level_order}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleEdit(level)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(level.id)}
                          className="text-red-600 hover:text-red-800"
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
        </div>
      )}

      {(pageMode === 'add' || pageMode === 'edit') && (
        <div className="space-y-4">
          <BackButton isDark={isDark} onClick={openHomePage} />
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{editingLevel ? 'Edit Resolver Level' : 'Add Resolver Level'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Department Head, Dean, President"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Level Order *</label>
                <input
                  type="number"
                  value={formData.level_order}
                  onChange={(e) => setFormData({ ...formData, level_order: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1, 2, 3..."
                  min="1"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={openHomePage}
                  className={`px-4 py-2 border rounded-lg transition-colors ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingLevel ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResolverLevelManagement;
