import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';

const UserFeedback = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [currentView, setCurrentView] = useState('list');
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveTemplates();
  }, []);

  const fetchActiveTemplates = async () => {
    try {
      const data = await apiService.getFeedbackTemplates();
      const templateList = Array.isArray(data) ? data : data.results || [];
      setTemplates(templateList.filter(template => template.status === 'active'));
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setCurrentView('form');
    setAnswers({});
  };

  const handleAnswerChange = (fieldId, value) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const formattedAnswers = selectedTemplate.fields.map(field => {
      const answer = { field_id: field.id };
      const value = answers[field.id];

      switch (field.field_type) {
        case 'text':
          answer.text_value = value || '';
          break;
        case 'number':
          answer.number_value = parseFloat(value) || null;
          break;
        case 'rating':
          answer.rating_value = parseInt(value, 10) || null;
          break;
        case 'choice':
          answer.choice_value = value || '';
          break;
        case 'checkbox':
          answer.checkbox_values = value || [];
          break;
        default:
          break;
      }

      return answer;
    });

    try {
      await apiService.submitFeedbackResponse({
        template: selectedTemplate.id,
        answers: formattedAnswers
      });
      setCurrentView('success');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert(error.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedTemplate(null);
    setAnswers({});
  };

  if (currentView === 'form' && selectedTemplate) {
    return (
      <div className="p-6">
        <button
          onClick={handleBackToList}
          className="mb-6 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          â† Back to Forms
        </button>

        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{selectedTemplate.title}</h2>
            {selectedTemplate.description && (
              <p className="text-gray-600 text-lg">{selectedTemplate.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">Office: {selectedTemplate.office}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {selectedTemplate.fields.map(field => (
              <div key={field.id} className="space-y-2">
                <label className={`block font-semibold text-lg ${
                  field.is_required ? 'text-red-600' : 'text-gray-700'
                }`}>
                  {field.label}
                  {field.is_required && <span className="text-red-500 ml-1">*</span>}
                </label>

                <FieldInput
                  field={field}
                  value={answers[field.id]}
                  onChange={(value) => handleAnswerChange(field.id, value)}
                />
              </div>
            ))}

            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (currentView === 'success') {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8">
            <div className="text-6xl mb-4">âœ…</div>
            <h2 className="text-2xl font-bold text-green-800 mb-4">Thank You!</h2>
            <p className="text-green-700 mb-6">Your feedback has been submitted successfully.</p>
            <button
              onClick={handleBackToList}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Submit More Feedback
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Available Feedback Forms</h1>
        <p className="text-gray-600">Select a form to provide your anonymous feedback</p>
      </div>

      {loading ? (
        <div className="text-center py-10 text-lg text-gray-600">Loading forms...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <div key={template.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{template.title}</h3>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {template.office}
                </span>
              </div>

              {template.description && (
                <p className="text-gray-600 mb-4 line-clamp-3">{template.description}</p>
              )}

              <div className="text-sm text-gray-500 mb-4">
                <p>Fields: {template.fields?.length || 0}</p>
                <p>Created by: {template.created_by || 'System'}</p>
              </div>

              <button
                onClick={() => handleSelectTemplate(template)}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Fill Form
              </button>
            </div>
          ))}
        </div>
      )}

      {templates.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-600">
          <div className="text-6xl mb-4">ðŸ“</div>
          <p className="text-xl mb-2">No feedback forms available</p>
          <p>Check back later for new forms from your office</p>
        </div>
      )}
    </div>
  );
};

const FieldInput = ({ field, value, onChange }) => {
  switch (field.field_type) {
    case 'text':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder={`Enter your ${field.label.toLowerCase()}`}
          className="w-full min-h-32 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-y"
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
        />
      );

    case 'rating':
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={`text-3xl transition-all ${
                value >= star ? 'text-yellow-400 scale-110' : 'text-gray-300 hover:text-yellow-200'
              }`}
              onClick={() => onChange(star)}
            >
              â­
            </button>
          ))}
          {value && (
            <span className="ml-4 text-lg font-semibold text-gray-700">
              {value}/5
            </span>
          )}
        </div>
      );

    case 'choice':
      return (
        <div className="space-y-3">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name={field.id}
                value={option}
                checked={value === option}
                onChange={(e) => onChange(e.target.value)}
                required={field.is_required}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-3">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={(value || []).includes(option)}
                onChange={(e) => {
                  const currentValues = value || [];
                  if (e.target.checked) {
                    onChange([...currentValues, option]);
                  } else {
                    onChange(currentValues.filter(v => v !== option));
                  }
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      );

    default:
      return <div className="text-red-500">Unknown field type: {field.field_type}</div>;
  }
};

export default UserFeedback;
