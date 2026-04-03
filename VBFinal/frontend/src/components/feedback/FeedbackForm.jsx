import React, { useState, useEffect, useCallback } from 'react';

const FeedbackForm = ({ templateId, onSubmit }) => {
  const [template, setTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplate = useCallback(async () => {
    try {
      const response = await fetch(`/api/feedback/templates/${templateId}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setTemplate(data);
    } catch (error) {
      console.error('Error fetching template:', error);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleAnswerChange = (fieldId, value) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const formattedAnswers = template.fields.map(field => {
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
          answer.rating_value = parseInt(value) || null;
          break;
        case 'choice':
          answer.choice_value = value || '';
          break;
        case 'checkbox':
          answer.checkbox_values = value || [];
          break;
      }
      return answer;
    });

    try {
      const response = await fetch('/api/feedback/responses/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template: templateId,
          answers: formattedAnswers
        })
      });

      if (response.ok) {
        onSubmit && onSubmit();
        alert('Feedback submitted successfully!');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-10 text-lg text-gray-600">Loading form...</div>;
  if (!template) return <div className="text-center py-10 text-lg text-red-600">Form not found</div>;

  return (
    <div className="max-w-3xl mx-auto p-5 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">{template.title}</h2>
        {template.description && <p className="text-gray-600">{template.description}</p>}
      </div>

      <form onSubmit={handleSubmit}>
        {template.fields.map(field => (
          <div key={field.id} className="mb-6">
            <label className={`block font-semibold mb-2 ${field.is_required ? 'text-red-600' : 'text-gray-700'}`}>
              {field.label}
              {field.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>

            <FieldInput
              field={field}
              value={answers[field.id]}
              onChange={(value) => handleAnswerChange(field.id, value)}
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-blue-500 text-white text-lg font-semibold rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
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
          className="w-full min-h-24 p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-y"
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
        />
      );

    case 'rating':
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={`text-2xl transition-opacity ${value >= star ? 'opacity-100' : 'opacity-30'} hover:opacity-70`}
              onClick={() => onChange(star)}
            >
              ⭐
            </button>
          ))}
        </div>
      );

    case 'choice':
      return (
        <div className="flex flex-col gap-3">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name={field.id}
                value={option}
                checked={value === option}
                onChange={(e) => onChange(e.target.value)}
                required={field.is_required}
                className="m-0"
              />
              {option}
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex flex-col gap-3">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
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
                className="m-0"
              />
              {option}
            </label>
          ))}
        </div>
      );

    default:
      return <div>Unknown field type</div>;
  }
};

export default FeedbackForm;
