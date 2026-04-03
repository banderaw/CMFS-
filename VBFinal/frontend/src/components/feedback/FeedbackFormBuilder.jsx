import React, { useState } from 'react';

const FIELD_TYPES = [
  { type: 'text', label: 'Text Input', icon: '📝' },
  { type: 'number', label: 'Number Input', icon: '🔢' },
  { type: 'rating', label: 'Rating Scale', icon: '⭐' },
  { type: 'choice', label: 'Multiple Choice', icon: '🔘' },
  { type: 'checkbox', label: 'Checkboxes', icon: '☑️' }
];

const FeedbackFormBuilder = ({ onSave }) => {
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState([]);

  const addField = (fieldType) => {
    const newField = {
      id: Date.now().toString(),
      label: `New ${fieldType} field`,
      field_type: fieldType,
      is_required: false,
      options: fieldType === 'choice' || fieldType === 'checkbox' ? ['Option 1'] : [],
      order: fields.length
    };
    setFields([...fields, newField]);
  };

  const updateField = (fieldId, updates) => {
    setFields(fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  const removeField = (fieldId) => {
    setFields(fields.filter(field => field.id !== fieldId));
  };

  const moveField = (fieldId, direction) => {
    const currentIndex = fields.findIndex(f => f.id === fieldId);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === fields.length - 1)
    ) return;

    const newFields = [...fields];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [newFields[currentIndex], newFields[targetIndex]] = [newFields[targetIndex], newFields[currentIndex]];

    const updatedFields = newFields.map((field, index) => ({
      ...field,
      order: index
    }));

    setFields(updatedFields);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      alert('Please enter a form title');
      return;
    }

    const templateData = {
      title: formTitle,
      description: formDescription,
      fields: fields.map(({ id: _id, ...field }) => field)
    };

    try {

      const response = await fetch('/api/feedback/templates/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(templateData)
      });


      if (response.ok) {
        onSave && onSave();
        alert('Feedback form created successfully!');
      } else {
        // Handle different response types
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to create form';

        try {
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.detail || error.message || 'Failed to create form';
          } else {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }

        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Failed to create form');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-5">
      <div className="mb-8">
        <input
          type="text"
          placeholder="Form Title"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          className="w-full text-2xl font-bold p-3 border-2 border-gray-300 rounded-lg mb-3"
        />
        <textarea
          placeholder="Form Description"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          className="w-full min-h-20 p-3 border-2 border-gray-300 rounded-lg resize-y"
        />
      </div>

      <div className="flex gap-8">
        <div className="flex-none w-64 bg-gray-50 p-5 rounded-lg h-fit">
          <h3 className="mt-0 text-gray-800 mb-4">Field Types</h3>
          {FIELD_TYPES.map(fieldType => (
            <button
              key={fieldType.type}
              onClick={() => addField(fieldType.type)}
              className="block w-full p-3 mb-3 bg-white border-2 border-blue-500 rounded-lg cursor-pointer transition-all hover:bg-blue-500 hover:text-white"
            >
              {fieldType.icon} {fieldType.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white p-5 border-2 border-gray-300 rounded-lg min-h-96">
          <h3 className="mb-5">Form Preview</h3>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4"
              >
                <FieldEditor
                  field={field}
                  index={index}
                  totalFields={fields.length}
                  onUpdate={(updates) => updateField(field.id, updates)}
                  onRemove={() => removeField(field.id)}
                  onMove={(direction) => moveField(field.id, direction)}
                />
              </div>
            ))}
            {fields.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Click on field types to add them to your form
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleSave}
          className="bg-green-500 text-white px-8 py-4 text-lg font-semibold rounded-lg hover:bg-green-600 transition-colors"
        >
          Save Feedback Form
        </button>
      </div>
    </div>
  );
};

const FieldEditor = ({ field, index, totalFields, onUpdate, onRemove, onMove }) => {
  const addOption = () => {
    const newOptions = [...field.options, `Option ${field.options.length + 1}`];
    onUpdate({ options: newOptions });
  };

  const updateOption = (index, value) => {
    const newOptions = [...field.options];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  };

  const removeOption = (index) => {
    const newOptions = field.options.filter((_, i) => i !== index);
    onUpdate({ options: newOptions });
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="flex-1 p-2 border border-gray-300 rounded mr-3"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="px-2 py-1 bg-gray-500 text-white rounded disabled:opacity-50"
          >
            ↑
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === totalFields - 1}
            className="px-2 py-1 bg-gray-500 text-white rounded disabled:opacity-50"
          >
            ↓
          </button>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={field.is_required}
              onChange={(e) => onUpdate({ is_required: e.target.checked })}
              className="mr-2"
            />
            Required
          </label>
          <button onClick={onRemove} className="text-lg">❌</button>
        </div>
      </div>

      {(field.field_type === 'choice' || field.field_type === 'checkbox') && (
        <div className="my-4 p-3 bg-white rounded">
          {field.options.map((option, index) => (
            <div key={index} className="flex gap-3 mb-2 items-center">
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                className="flex-1 p-1 border border-gray-300 rounded"
              />
              <button
                onClick={() => removeOption(index)}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addOption}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Option
          </button>
        </div>
      )}

      <div className="mt-4 p-3 bg-white rounded border border-gray-200">
        <FieldPreview field={field} />
      </div>
    </div>
  );
};

const FieldPreview = ({ field }) => {
  switch (field.field_type) {
    case 'text':
      return <input type="text" placeholder={field.label} disabled className="w-full p-2 border border-gray-300 rounded" />;
    case 'number':
      return <input type="number" placeholder={field.label} disabled className="w-full p-2 border border-gray-300 rounded" />;
    case 'rating':
      return (
        <div className="flex">
          {[1, 2, 3, 4, 5].map(star => (
            <span key={star} className="text-2xl">⭐</span>
          ))}
        </div>
      );
    case 'choice':
      return (
        <div className="space-y-2">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center">
              <input type="radio" name={field.id} disabled className="mr-2" />
              {option}
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center">
              <input type="checkbox" disabled className="mr-2" />
              {option}
            </label>
          ))}
        </div>
      );
    default:
      return <div>Unknown field type</div>;
  }
};

export default FeedbackFormBuilder;
