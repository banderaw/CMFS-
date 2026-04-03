import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';

const SubmitComplaint = ({ institutions, setSubmitSuccess }) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [complaintForm, setComplaintForm] = useState({
    title: '',
    description: '',
    institution: '',
    category: ''
  });
  const [files, setFiles] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [officers, setOfficers] = useState([]);
  const [ccOfficerIds, setCcOfficerIds] = useState([]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await apiService.getCategoriesByLanguage(language);
      setCategories(response || []);

      const usersData = await apiService.getAllUsers();
      const allUsers = usersData?.results || usersData || [];
      setOfficers(allUsers.filter((u) => u.role === 'officer'));
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, [language]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const validateForm = () => {
    const errors = {};
    if (!complaintForm.title.trim()) errors.title = t('required');
    if (!complaintForm.description.trim()) errors.description = t('required');
    if (!complaintForm.institution) errors.institution = t('required');
    if (!complaintForm.category) errors.category = t('required');
    if (complaintForm.description.length > 500) {
      errors.description = language === 'am' ? 'መግለጫው ከ500 ቁምፊዎች በታች መሆን አለበት' : 'Description must be under 500 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    if (validFiles.length !== selectedFiles.length) {
      const message = language === 'am'
        ? 'አንዳንድ ፋይሎች ተቀባይነት አላገኙም። ከ5MB በታች ያሉ ምስሎች፣ PDF እና ሰነዶች ብቻ ይፈቀዳሉ።'
        : 'Some files were rejected. Only images, PDFs, and documents under 5MB are allowed.';
      alert(message);
    }

    setFiles(prev => [...prev, ...validFiles].slice(0, 5)); // Max 5 files
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleCcOfficer = (officerId) => {
    setCcOfficerIds((prev) => (
      prev.includes(officerId)
        ? prev.filter((id) => id !== officerId)
        : [...prev, officerId]
    ));
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', complaintForm.title);
      formData.append('description', complaintForm.description);
      formData.append('institution', complaintForm.institution);
      formData.append('category', complaintForm.category);

      // CC officers as JSON
      if (ccOfficerIds.length > 0) {
        formData.append('cc_officer_ids', JSON.stringify(ccOfficerIds));
      }

      // Add files to form data
      files.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await apiService.createComplaint(formData);

      if (response) {
        setComplaintForm({ title: '', description: '', institution: '', category: '' });
        setFiles([]);
        setCcOfficerIds([]);
        setFormErrors({});
        setSubmitSuccess(true);

        // Hide success message after 5 seconds
        setTimeout(() => setSubmitSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      const message = language === 'am'
        ? 'ቅሬታ ማስገባት አልተሳካም። እባክዎ እንደገና ይሞክሩ።'
        : 'Failed to submit complaint. Please try again.';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type === 'application/pdf') return '📄';
    if (file.type.includes('word')) return '📝';
    return '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('submit_new_complaint')}
          </h3>
          {/* <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            🤖 {t('ai_will_detect')}
          </p> */}
        </div>

        <div className="p-6">
          <form onSubmit={submitComplaint} className="space-y-6">
            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                {t('title')} *
              </label>
              <input
                type="text"
                value={complaintForm.title}
                onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'} ${formErrors.title ? 'border-red-500' : ''}`}
                placeholder={t('brief_title')}
              />
              {formErrors.title && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.title}</p>}
            </div>

            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                {t('description')} *
              </label>
              <textarea
                value={complaintForm.description}
                onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                rows={5}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'} ${formErrors.description ? 'border-red-500' : ''}`}
                placeholder={t('detailed_description')}
              />
              <div className="flex justify-between items-center mt-1">
                {formErrors.description && <p className="text-red-500 text-sm flex items-center"><span className="mr-1">⚠️</span>{formErrors.description}</p>}
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} ml-auto`}>
                  {complaintForm.description.length}/500
                </p>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                {t('institution')} *
              </label>
              <select
                value={complaintForm.institution}
                onChange={(e) => setComplaintForm({ ...complaintForm, institution: e.target.value })}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${formErrors.institution ? 'border-red-500' : ''}`}
              >
                <option value="">{t('select_institution')}</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
              {formErrors.institution && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.institution}</p>}
            </div>

            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                {language === 'am' ? 'ምድብ' : 'Category'} *
              </label>
              <select
                value={complaintForm.category}
                onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${formErrors.category ? 'border-red-500' : ''}`}
              >
                <option value="">{language === 'am' ? 'ምድብ ይምረጡ' : 'Select category'}</option>
                {categories.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {formErrors.category && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.category}</p>}
            </div>

            {/* CC */}
            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                {language === 'am' ? 'CC ኦፊሰሮች ይምረጡ' : 'CC Officers (Select one or more)'}
              </label>
              <div className={`w-full border rounded-lg px-3 py-3 max-h-52 overflow-y-auto ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                {officers.length === 0 ? (
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {language === 'am' ? 'ኦፊሰሮች አልተገኙም' : 'No officers found'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {officers.map((officer) => (
                      <label key={officer.id} className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        <input
                          type="checkbox"
                          checked={ccOfficerIds.includes(officer.id)}
                          onChange={() => toggleCcOfficer(officer.id)}
                        />
                        <span>{officer.first_name} {officer.last_name} ({officer.email})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {language === 'am'
                  ? `የተመረጡ ኦፊሰሮች: ${ccOfficerIds.length}`
                  : `Selected officers: ${ccOfficerIds.length}`}
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                {language === 'am' ? 'ፋይሎች አያይዝ (አማራጭ)' : 'Attach Files (Optional)'}
              </label>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center ${isDark ? 'border-gray-600 bg-gray-750' : 'border-gray-300 bg-gray-50'}`}>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.doc,.docx"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-4xl mb-2">📎</div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {language === 'am'
                      ? 'ፋይሎችን ለመጫን ይጫኑ ወይም እዚህ ይጎትቱ'
                      : 'Click to upload files or drag and drop'
                    }
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                    {language === 'am'
                      ? 'ከ5MB በታች ያሉ ምስሎች፣ PDF፣ ሰነዶች (ከ5 ፋይሎች በታች)'
                      : 'Images, PDFs, Documents under 5MB (Max 5 files)'
                    }
                  </p>
                </label>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getFileIcon(file)}</span>
                        <div>
                          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {file.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  setComplaintForm({ title: '', description: '', institution: '', category: '' });
                  setFiles([]);
                  setCcOfficerIds([]);
                  setFormErrors({});
                }}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{loading ? t('loading') : t('submit')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitComplaint;
