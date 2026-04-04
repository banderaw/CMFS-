import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import Modal from '../UI/Modal';

const ResolverLevelManagement = () => {
  const { isDark } = useTheme();
  const [resolverLevels, setResolverLevels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    level_order: '',
    escalation_time: ''
  });

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
      setShowModal(false);
      setEditingLevel(null);
      setFormData({ name: '', level_order: '', escalation_time: '' });
      loadData();
    } catch (error) {
      console.error('Failed to save resolver level:', error);
    }
  };

  const handleEdit = (level) => {
    setEditingLevel(level);
    setFormData({
      name: level.name,
      level_order: level.level_order,
      escalation_time: level.escalation_time
    });
    setShowModal(true);
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-700">Resolver Level Management</h3>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Resolver Level
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Escalation Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(resolverLevels || []).length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                  No resolver levels found. Click "Add Resolver Level" to create one.
                </td>
              </tr>
            ) : (
              (resolverLevels || []).map((level) => (
                <tr key={level.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{level.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">Level {level.level_order}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{level.escalation_time}</td>
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

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingLevel(null);
          setFormData({ name: '', level_order: '', escalation_time: '' });
        }}
        title={editingLevel ? 'Edit Resolver Level' : 'Add Resolver Level'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700">Escalation Time *</label>
            <input
              type="text"
              value={formData.escalation_time}
              onChange={(e) => setFormData({ ...formData, escalation_time: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 2 days, 48 hours"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Format: "X days" or "X hours"</p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
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
      </Modal>
    </div>
  );
};

export default ResolverLevelManagement;
