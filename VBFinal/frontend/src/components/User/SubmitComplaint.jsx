import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';

const SubmitComplaint = ({ setSubmitSuccess }) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [complaintForm, setComplaintForm] = useState({
    title: '',
    description: '',
    category: '',
    isAnonymous: false,
  });
  const [files, setFiles] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  const [ccOfficeIds, setCcOfficeIds] = useState([]);
  const totalSteps = 4;

  const getCategoryId = (category) => String(category.category_id || category.id || '');

  const buildCategoryLabel = useCallback((category, map, visited = new Set()) => {
    const categoryId = getCategoryId(category);
    if (!categoryId || visited.has(categoryId)) {
      return category.name || category.office_name || category.category_id;
    }

    visited.add(categoryId);
    const parentId = String(category.parent || '');
    const currentName = category.name || category.office_name || category.category_id;
    if (!parentId || !map[parentId]) {
      return currentName;
    }

    const parentLabel = buildCategoryLabel(map[parentId], map, visited);
    return `${parentLabel} > ${currentName}`;
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const categoriesResponse = await apiService.getAllCategories();
      const rawCategories = (categoriesResponse?.results || categoriesResponse || [])
        .filter((item) => item && item.is_active !== false);
      const categoryMap = rawCategories.reduce((acc, item) => {
        acc[String(item.category_id || item.id)] = item;
        return acc;
      }, {});

      const categoryOptions = rawCategories
        .map((item) => ({
          ...item,
          label: buildCategoryLabel(item, categoryMap),
          value: getCategoryId(item),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setCategories(categoryOptions);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }

    try {
      const resolverData = await apiService.getAllCategoryResolvers();
      setCategoryResolvers(resolverData?.results || resolverData || []);
    } catch (error) {
      console.warn('Failed to load category resolvers:', error);
      setCategoryResolvers([]);
    }

  }, [buildCategoryLabel]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const validateForm = () => {
    const errors = {};
    if (!complaintForm.title.trim()) errors.title = t('required');
    if (!complaintForm.description.trim()) errors.description = t('required');
    if (!complaintForm.category) errors.category = t('required');
    if (complaintForm.description.length > 500) {
      errors.description = language === 'am' ? 'መግለጫው ከ500 ቁምፊዎች በታች መሆን አለበት' : 'Description must be under 500 characters';
    }

    setFormErrors(errors);
    return errors;
  };

  const clearForm = () => {
    setComplaintForm({ title: '', description: '', category: '', isAnonymous: false });
    setFiles([]);
    setCcOfficeIds([]);
    setFormErrors({});
    setCurrentStep(1);
  };

  const categoryOfficers = categoryResolvers
    .filter((resolver) => String(resolver.category) === String(complaintForm.category) && resolver.active)
    .sort((a, b) => (a.level_name || '').localeCompare(b.level_name || ''));

  const ccOfficeOptions = categories;
  const selectedCcOffices = ccOfficeOptions.filter((office) => ccOfficeIds.includes(office.value));

  const validateStep = (step) => {
    const errors = validateForm();
    if (step === 1) {
      return !errors.title && !errors.description;
    }
    if (step === 2) {
      return !errors.category;
    }
    return true;
  };

  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
    }
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
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

  const handleCcOfficeChange = (event) => {
    const selectedOfficeIds = Array.from(event.target.selectedOptions).map((option) => option.value);
    setCcOfficeIds(selectedOfficeIds);
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      if (errors.title || errors.description) {
        setCurrentStep(1);
      } else if (errors.category) {
        setCurrentStep(2);
      }
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', complaintForm.title);
      formData.append('description', complaintForm.description);
      formData.append('category', complaintForm.category);
      formData.append('is_anonymous', complaintForm.isAnonymous ? 'true' : 'false');

      // CC backend offices as JSON
      if (ccOfficeIds.length > 0) {
        formData.append('cc_office_ids', JSON.stringify(ccOfficeIds));
      }

      // Add files to form data
      files.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await apiService.createComplaint(formData);

      if (response) {
        clearForm();
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
        </div>

        <div className="p-6">
          <form onSubmit={submitComplaint} className="space-y-6">
            <div className="flex items-center justify-between">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {language === 'am' ? `ደረጃ ${currentStep} / ${totalSteps}` : `Step ${currentStep} of ${totalSteps}`}
              </p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-2 w-10 rounded-full ${step <= currentStep ? 'bg-blue-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            </div>

            {currentStep === 1 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {language === 'am' ? '1. የቅሬታ ዝርዝሮች' : '1. Complaint Details'}
                </h4>
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
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {language === 'am' ? '2. ምድብ እና ተዛማጅ መረጃ' : '2. Classification'}
                </h4>

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
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.category && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.category}</p>}
                </div>

                <div className={`rounded-lg border p-3 ${isDark ? 'border-gray-600 bg-gray-800' : 'border-blue-200 bg-blue-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-300' : 'text-blue-700'}`}>
                    {language === 'am' ? 'የተመደቡ መፍትሄ ኦፊሰሮች' : 'Assigned Resolver Officers'}
                  </p>
                  {complaintForm.category ? (
                    categoryOfficers.length > 0 ? (
                      <ul className={`mt-2 space-y-1 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        {categoryOfficers.map((resolver) => (
                          <li key={resolver.id}>
                            {resolver.level_name}: {resolver.officer_name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {language === 'am' ? 'ለዚህ ምድብ ገና ኦፊሰር አልተመደበም።' : 'No resolver officers are assigned to this category yet.'}
                      </p>
                    )
                  ) : (
                    <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {language === 'am' ? 'እባክዎ መጀመሪያ ምድብ ይምረጡ።' : 'Select a category first to preview responsible officers.'}
                    </p>
                  )}
                </div>

                <label className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={complaintForm.isAnonymous}
                    onChange={(e) => setComplaintForm({ ...complaintForm, isAnonymous: e.target.checked })}
                  />
                  <span>
                    {language === 'am'
                      ? 'ቅሬታዬን በማንነት ሳይገለጽ እንዲታይ እፈልጋለሁ (ለኦፊሰሮች ብቻ ማንነት ይደበቃል)'
                      : 'Submit as anonymous to officers (your identity is hidden from officers but preserved for audit/admin).'}
                  </span>
                </label>

                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    {language === 'am' ? 'CC የቢሮ አማራጮች ይምረጡ' : 'CC Backend Offices (Select one or more)'}
                  </label>
                  <select
                    multiple
                    value={ccOfficeIds}
                    onChange={handleCcOfficeChange}
                    className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-40 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    {ccOfficeOptions.length === 0 ? (
                      <option value="">{language === 'am' ? 'ቢሮዎች አልተገኙም' : 'No backend offices found'}</option>
                    ) : (
                      ccOfficeOptions.map((office) => (
                        <option key={office.value} value={office.value}>
                          {office.label}
                        </option>
                      ))
                    )}
                  </select>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {language === 'am'
                      ? `የተመረጡ ቢሮዎች: ${ccOfficeIds.length}`
                      : `Selected backend offices: ${ccOfficeIds.length}`}
                  </p>
                  {selectedCcOffices.length > 0 && (
                    <div className={`mt-2 flex flex-wrap gap-2 text-xs ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {selectedCcOffices.map((office) => (
                        <span
                          key={office.value}
                          className={`rounded-full px-3 py-1 ${isDark ? 'bg-gray-700' : 'bg-blue-100 text-blue-700'}`}
                        >
                          {office.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {language === 'am' ? '3. ማስረጃ ፋይሎች' : '3. Evidence Attachments'}
                </h4>
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
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {language === 'am' ? '4. ክለሳ እና ማስገባት' : '4. Review & Submit'}
                </h4>
                <div className={`rounded-lg border p-4 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-semibold">{t('title')}:</span> {complaintForm.title || '-'}</p>
                    <p><span className="font-semibold">{t('description')}:</span> {complaintForm.description || '-'}</p>
                    <p>
                      <span className="font-semibold">{language === 'am' ? 'ምድብ' : 'Category'}:</span>{' '}
                      {categories.find((item) => String(item.value) === String(complaintForm.category))?.label || '-'}
                    </p>
                    <p><span className="font-semibold">{language === 'am' ? 'ማንነት ሁኔታ' : 'Identity'}:</span> {complaintForm.isAnonymous ? (language === 'am' ? 'ስውር' : 'Anonymous') : (language === 'am' ? 'ተገልጿል' : 'Visible')}</p>
                    <p><span className="font-semibold">{language === 'am' ? 'CC ቢሮዎች' : 'CC Backend Offices'}:</span> {ccOfficeIds.length}</p>
                    <p><span className="font-semibold">{language === 'am' ? 'ፋይሎች' : 'Attachments'}:</span> {files.length}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={clearForm}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t('cancel')}
              </button>

              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={goToPreviousStep}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                  >
                    {language === 'am' ? 'ወደ ኋላ' : 'Back'}
                  </button>
                )}

                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {language === 'am' ? 'ቀጣይ' : 'Next'}
                  </button>
                ) : (
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
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitComplaint;
