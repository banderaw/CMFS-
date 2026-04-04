import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const defaultField = () => ({
  id: Date.now().toString(),
  label: '',
  field_type: 'text',
  is_required: true,
  options: [],
  order: 0,
});

const FeedbackTemplateManagement = () => {
  const { isDark } = useTheme();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [selectedOfficer, setSelectedOfficer] = useState('all');
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    description: '',
    priority: 'medium',
    fields: [defaultField()]
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiService.getFeedbackTemplates();
      setTemplates(response.results || response || []);
    } catch (loadError) {
      console.error('Failed to load templates:', loadError);
      setTemplates([]);
      setError(loadError.message || 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  const resetNewTemplate = () => {
    setNewTemplate({
      title: '',
      description: '',
      priority: 'medium',
      fields: [defaultField()]
    });
  };

  const updateField = (fieldId, updates) => {
    setNewTemplate(prev => ({
      ...prev,
      fields: prev.fields.map((field, index) =>
        field.id === fieldId ? { ...field, ...updates, order: index } : field
      )
    }));
  };

  const addField = () => {
    setNewTemplate(prev => ({
      ...prev,
      fields: [
        ...prev.fields,
        { ...defaultField(), id: `${Date.now()}-${prev.fields.length}`, order: prev.fields.length }
      ]
    }));
  };

  const removeField = (fieldId) => {
    setNewTemplate(prev => ({
      ...prev,
      fields: prev.fields
        .filter(field => field.id !== fieldId)
        .map((field, index) => ({ ...field, order: index }))
    }));
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (newTemplate.fields.length === 0 || newTemplate.fields.some(field => !field.label.trim())) {
      alert('Please add at least one field with a label');
      return;
    }

    try {
      await apiService.createFeedbackTemplate({
        title: newTemplate.title.trim(),
        description: newTemplate.description.trim(),
        priority: newTemplate.priority,
        fields: newTemplate.fields.map(({ id: _id, ...field }, index) => ({
          ...field,
          options: field.field_type === 'choice' || field.field_type === 'checkbox' ? field.options.filter(Boolean) : [],
          order: index,
        }))
      });

      resetNewTemplate();
      setShowCreateModal(false);
      await loadTemplates();
      alert('Template created successfully!');
    } catch (createError) {
      console.error('Failed to create template:', createError);
      alert(createError.message || 'Failed to create template');
    }
  };

  const handleAction = async (action, templateId, successMessage) => {
    try {
      if (action === 'approve') await apiService.approveFeedbackTemplate(templateId);
      if (action === 'reject') await apiService.rejectFeedbackTemplate(templateId);
      if (action === 'activate') await apiService.activateFeedbackTemplate(templateId);
      if (action === 'deactivate') await apiService.deactivateFeedbackTemplate(templateId);
      if (action === 'close') await apiService.closeFeedbackTemplate(templateId);
      if (action === 'delete') await apiService.deleteFeedbackTemplate(templateId);
      await loadTemplates();
      alert(successMessage);
    } catch (actionError) {
      console.error(`Failed to ${action} template:`, actionError);
      alert(actionError.message || `Failed to ${action} template`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'closed': return 'bg-red-100 text-red-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTemplates = templates.filter(template => {
    let matchesType = true;
    let matchesOfficer = true;

    if (filterType === 'officer_created') matchesType = template.created_by_role === 'officer';
    if (filterType === 'admin_created') matchesType = template.created_by_role === 'admin';

    if (selectedOfficer !== 'all') {
      matchesOfficer = template.created_by === selectedOfficer;
    }

    return matchesType && matchesOfficer;
  });

  const getUniqueOfficers = () => {
    const officers = templates
      .filter(template => template.created_by_role === 'officer')
      .map(template => template.created_by);
    return [...new Set(officers)];
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Feedback Template Management
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage backend feedback templates and approval workflow
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Template
          </button>
        </div>
      </div>

      {error && (
        <div className={`${isDark ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} border rounded-lg p-4`}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <StatCard isDark={isDark} label="Active" value={templates.filter(t => t.status === 'active').length} icon="âœ…" color="text-green-500" />
        <StatCard isDark={isDark} label="Pending" value={templates.filter(t => t.status === 'pending').length} icon="â³" color="text-yellow-500" />
        <StatCard isDark={isDark} label="Inactive" value={templates.filter(t => t.status === 'inactive').length} icon="â¸ï¸" color="text-gray-500" />
        <StatCard isDark={isDark} label="Closed" value={templates.filter(t => t.status === 'closed').length} icon="ðŸ”’" color="text-red-500" />
        <StatCard isDark={isDark} label="By Officers" value={templates.filter(t => t.created_by_role === 'officer').length} icon="ðŸ‘®" color="text-orange-500" />
        <StatCard isDark={isDark} label="Total" value={templates.length} icon="ðŸ“" color="text-indigo-500" />
      </div>

      {templates.filter(t => t.created_by_role === 'officer').length > 0 && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            Templates by Officer
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getUniqueOfficers().map(officer => {
              const officerTemplates = templates.filter(template => template.created_by === officer);
              return (
                <div key={officer} className={`p-4 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{officer}</h4>
                    <button
                      onClick={() => {
                        setFilterType('officer_created');
                        setSelectedOfficer(officer);
                      }}
                      className="text-blue-500 hover:text-blue-600 text-sm"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Total:</span>
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{officerTemplates.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Active:</span>
                      <span className="font-medium text-green-600">{officerTemplates.filter(t => t.status === 'active').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Pending:</span>
                      <span className="font-medium text-yellow-600">{officerTemplates.filter(t => t.status === 'pending').length}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              All Templates
            </h4>
            <div className="flex space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`px-3 py-1 border rounded text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="all">All Templates</option>
                <option value="officer_created">Officer Created</option>
                <option value="admin_created">Admin Created</option>
              </select>

              {filterType === 'officer_created' && (
                <select
                  value={selectedOfficer}
                  onChange={(e) => setSelectedOfficer(e.target.value)}
                  className={`px-3 py-1 border rounded text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="all">All Officers</option>
                  {getUniqueOfficers().map(officer => (
                    <option key={officer} value={officer}>{officer}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-2">ðŸ“</div>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No templates found for {selectedOfficer !== 'all' ? `"${selectedOfficer}"` : `"${filterType.replace('_', ' ')}"`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {template.title}
                      </h5>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(template.status)}`}>
                        {template.status.toUpperCase()}
                      </span>
                      <span className={`text-sm font-medium ${getPriorityColor(template.priority)}`}>
                        {template.priority.toUpperCase()}
                      </span>
                    </div>

                    {template.description && (
                      <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                        {template.description}
                      </p>
                    )}

                    <div className="flex items-center space-x-4 text-sm flex-wrap">
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Office: <span className="font-medium">{template.office}</span>
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Created by: <span className={`font-medium ${template.created_by_role === 'officer' ? 'text-orange-600' : 'text-blue-600'}`}>
                          {template.created_by} ({template.created_by_role})
                        </span>
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Fields: {template.fields?.length || 0}
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Created: {new Date(template.created_at).toLocaleString()}
                      </span>
                      {template.approved_by && (
                        <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Approved by: <span className="font-medium">{template.approved_by}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 ml-4">
                    {template.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleAction('approve', template.id, 'Template approved successfully!')}
                          className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction('reject', template.id, 'Template rejected.')}
                          className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(template.status === 'inactive' || template.status === 'rejected' || template.status === 'draft') && (
                      <button
                        onClick={() => handleAction('activate', template.id, 'Template activated successfully!')}
                        className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
                      >
                        Activate
                      </button>
                    )}
                    {template.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleAction('deactivate', template.id, 'Template deactivated successfully!')}
                          className="bg-orange-500 text-white px-4 py-2 rounded text-sm hover:bg-orange-600 transition-colors"
                        >
                          Deactivate
                        </button>
                        <button
                          onClick={() => handleAction('close', template.id, 'Template closed successfully!')}
                          className="bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 transition-colors"
                        >
                          Close
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleAction('delete', template.id, 'Template deleted successfully!')}
                      className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Create New Template
            </h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Title *
                </label>
                <input
                  type="text"
                  value={newTemplate.title}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, title: e.target.value }))}
                  className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  placeholder="Template title"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Description
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  rows="3"
                  placeholder="Template description"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Priority
                </label>
                <select
                  value={newTemplate.priority}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, priority: e.target.value }))}
                  className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Fields</h4>
                  <button
                    onClick={addField}
                    className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                  >
                    Add Field
                  </button>
                </div>

                {newTemplate.fields.map((field, index) => (
                  <div key={field.id} className={`p-4 rounded border ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        placeholder={`Field ${index + 1} label`}
                        className={`p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                      />
                      <select
                        value={field.field_type}
                        onChange={(e) => updateField(field.id, {
                          field_type: e.target.value,
                          options: e.target.value === 'choice' || e.target.value === 'checkbox' ? field.options : []
                        })}
                        className={`p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="rating">Rating</option>
                        <option value="choice">Choice</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      <div className="flex items-center justify-between gap-2">
                        <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          <input
                            type="checkbox"
                            checked={field.is_required}
                            onChange={(e) => updateField(field.id, { is_required: e.target.checked })}
                          />
                          Required
                        </label>
                        {newTemplate.fields.length > 1 && (
                          <button
                            onClick={() => removeField(field.id)}
                            className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {(field.field_type === 'choice' || field.field_type === 'checkbox') && (
                      <div className="mt-3">
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Options
                        </label>
                        <input
                          type="text"
                          value={field.options.join(', ')}
                          onChange={(e) => updateField(field.id, {
                            options: e.target.value.split(',').map(option => option.trim()).filter(Boolean)
                          })}
                          placeholder="Option 1, Option 2, Option 3"
                          className={`w-full p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  resetNewTemplate();
                  setShowCreateModal(false);
                }}
                className={`px-4 py-2 rounded ${isDark ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ isDark, label, value, icon, color }) => (
  <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow hover:shadow-md transition-shadow`}>
    <div className="flex items-center justify-between">
      <div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</div>
      </div>
      <div className="text-3xl">{icon}</div>
    </div>
  </div>
);

export default FeedbackTemplateManagement;
