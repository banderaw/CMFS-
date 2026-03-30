import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import Modal from '../UI/Modal';
import ResolverLevelManagement from './ResolverLevelManagement';
import { CategoryManagement } from './CategoryManagement';
import CategoryResolverManagement from './CategoryResolverManagement';

const CrudSection = ({ isDark, title, items, columns, onAdd, onEdit, onDelete, loading }) => {
  const thCls = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
  const tdCls = 'px-4 py-3 whitespace-nowrap text-sm';
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-700'}`}>{title}</h3>
        <button onClick={onAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm w-full sm:w-auto">
          + Add
        </button>
      </div>
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full divide-y divide-gray-200">
            <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                {columns.map(c => <th key={c.key} className={thCls}>{c.label}</th>)}
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-500">
                    No records found.
                  </td>
                </tr>
              ) : items.map(item => (
                <tr key={item.id} className={isDark ? 'bg-gray-800' : 'hover:bg-gray-50'}>
                  {columns.map(c => (
                    <td key={c.key} className={`${tdCls} ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {c.render ? c.render(item) : item[c.key] ?? '—'}
                    </td>
                  ))}
                  <td className={`${tdCls} space-x-3`}>
                    <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                    <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const FormModal = ({ isDark, isOpen, onClose, title, fields, formData, onChange, onSubmit, editing }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit ${title}` : `Add ${title}`}>
    <form onSubmit={onSubmit} className="space-y-4">
      {fields.map(f => (
        <div key={f.key}>
          <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {f.label}{f.required ? ' *' : ''}
          </label>
          {f.type === 'select' ? (
            <select
              required={f.required}
              value={formData[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="">Select {f.label}</option>
              {f.options.map(o => <option key={o.id} value={o.id}>{o[f.displayKey]}</option>)}
            </select>
          ) : f.type === 'checkbox' ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData[f.key]}
                onChange={e => onChange(f.key, e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Enabled</span>
            </div>
          ) : (
            <input
              type="text"
              required={f.required}
              value={formData[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          )}
        </div>
      ))}
      <div className="flex justify-end space-x-3 pt-2">
        <button type="button" onClick={onClose}
          className={`px-4 py-2 border rounded-lg ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {editing ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  </Modal>
);

const InstitutionManagement = () => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('institutions');

  // Institutions (existing /api/institutions/)
  const [institutions, setInstitutions] = useState([]);
  const [instLoading, setInstLoading] = useState(false);
  const [instModal, setInstModal] = useState(false);
  const [instEditing, setInstEditing] = useState(null);
  const [instForm, setInstForm] = useState({ name: '', domain: '' });

  // Campuses
  const [campuses, setCampuses] = useState([]);
  const [campLoading, setCampLoading] = useState(false);
  const [campModal, setCampModal] = useState(false);
  const [campEditing, setCampEditing] = useState(null);
  const [campForm, setCampForm] = useState({ campus_name: '' });

  // Colleges
  const [colleges, setColleges] = useState([]);
  const [colLoading, setColLoading] = useState(false);
  const [colModal, setColModal] = useState(false);
  const [colEditing, setColEditing] = useState(null);
  const [colForm, setColForm] = useState({ college_name: '', college_campus: '' });

  // Departments
  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptModal, setDeptModal] = useState(false);
  const [deptEditing, setDeptEditing] = useState(null);
  const [deptForm, setDeptForm] = useState({ department_name: '', department_college: '' });

  const load = async (tab) => {
    if (tab === 'institutions') {
      setInstLoading(true);
      try { const d = await apiService.getInstitutions(); setInstitutions(d.results ?? d); } catch {}
      finally { setInstLoading(false); }
    }
    if (tab === 'campuses') {
      setCampLoading(true);
      try { const d = await apiService.getCampuses(); setCampuses(d.results ?? d); } catch {}
      finally { setCampLoading(false); }
    }
    if (tab === 'colleges') {
      setCampLoading(true); setColLoading(true);
      try {
        const [c, col] = await Promise.all([apiService.getCampuses(), apiService.getColleges()]);
        setCampuses(c.results ?? c);
        setColleges(col.results ?? col);
      } catch {}
      finally { setCampLoading(false); setColLoading(false); }
    }
    if (tab === 'departments') {
      setColLoading(true); setDeptLoading(true);
      try {
        const [col, dept] = await Promise.all([apiService.getColleges(), apiService.getDepartments()]);
        setColleges(col.results ?? col);
        setDepartments(dept.results ?? dept);
      } catch {}
      finally { setColLoading(false); setDeptLoading(false); }
    }
  };

  useEffect(() => { load('institutions'); }, []);
  useEffect(() => { load(activeTab); }, [activeTab]);

  // Generic submit/delete helpers
  const handleSubmit = async (e, editing, form, createFn, updateFn, reloadTab) => {
    e.preventDefault();
    try {
      if (editing) await updateFn(editing.id, form);
      else await createFn(form);
      load(reloadTab);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id, deleteFn, reloadTab) => {
    if (!confirm('Delete this record?')) return;
    try { await deleteFn(id); load(reloadTab); } catch (err) { console.error(err); }
  };

  const tabs = [
    { id: 'institutions', label: 'Institutions', icon: '🏛️' },
    { id: 'campuses', label: 'Campuses', icon: '🗺️' },
    { id: 'colleges', label: 'Colleges', icon: '🎓' },
    { id: 'departments', label: 'Departments', icon: '🏢' },
    { id: 'offices', label: 'Office', icon: '📂' },
    { id: 'office-assignments', label: 'Assignment', icon: '👥' },
    { id: 'resolver-levels', label: 'Resolver Levels', icon: '⚡' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'institutions':
        return (
          <>
            <CrudSection
              isDark={isDark} title="Institutions" items={institutions} loading={instLoading}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'domain', label: 'Domain' },
                { key: 'created_at', label: 'Created', render: i => i.created_at ? new Date(i.created_at).toLocaleDateString() : '—' },
              ]}
              onAdd={() => { setInstEditing(null); setInstForm({ name: '', domain: '' }); setInstModal(true); }}
              onEdit={i => { setInstEditing(i); setInstForm({ name: i.name, domain: i.domain }); setInstModal(true); }}
              onDelete={id => handleDelete(id, apiService.deleteInstitution.bind(apiService), 'institutions')}
            />
            <FormModal isDark={isDark} isOpen={instModal} onClose={() => setInstModal(false)}
              title="Institution" editing={instEditing} formData={instForm}
              onChange={(k, v) => setInstForm(p => ({ ...p, [k]: v }))}
              onSubmit={e => { handleSubmit(e, instEditing, instForm, apiService.createInstitution.bind(apiService), apiService.updateInstitution.bind(apiService), 'institutions'); setInstModal(false); }}
              fields={[
                { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Gondar University' },
                { key: 'domain', label: 'Domain', required: true, placeholder: 'e.g. uog.edu.et' },
              ]}
            />
          </>
        );

      case 'campuses':
        return (
          <>
            <CrudSection
              isDark={isDark} title="Campuses" items={campuses} loading={campLoading}
              columns={[
                { key: 'campus_name', label: 'Name' },
                { key: 'location', label: 'Location' },
                { key: 'description', label: 'Description' },
                { key: 'is_active', label: 'Active', render: c => c.is_active ? '✅' : '❌' },
              ]}
              onAdd={() => { setCampEditing(null); setCampForm({ campus_name: '', location: '', description: '', is_active: true }); setCampModal(true); }}
              onEdit={i => { setCampEditing(i); setCampForm({ campus_name: i.campus_name, location: i.location, description: i.description, is_active: i.is_active }); setCampModal(true); }}
              onDelete={id => handleDelete(id, apiService.deleteCampus.bind(apiService), 'campuses')}
            />
            <FormModal isDark={isDark} isOpen={campModal} onClose={() => setCampModal(false)}
              title="Campus" editing={campEditing} formData={campForm}
              onChange={(k, v) => setCampForm(p => ({ ...p, [k]: v }))}
              onSubmit={e => { handleSubmit(e, campEditing, campForm, apiService.createCampus.bind(apiService), apiService.updateCampus.bind(apiService), 'campuses'); setCampModal(false); }}
              fields={[
                { key: 'campus_name', label: 'Campus Name', required: true, placeholder: 'e.g. Main Campus' },
                { key: 'location', label: 'Location', placeholder: 'e.g. Gondar, Ethiopia' },
                { key: 'description', label: 'Description', placeholder: 'Brief description...' },
                { key: 'is_active', label: 'Active', type: 'checkbox' },
              ]}
            />
          </>
        );

      case 'colleges':
        return (
          <>
            <CrudSection
              isDark={isDark} title="Colleges" items={colleges} loading={colLoading}
              columns={[
                { key: 'college_name', label: 'Name' },
                { key: 'college_code', label: 'Code' },
                { key: 'campus_name', label: 'Campus', render: c => c.campus_name || '—' },
                { key: 'dean', label: 'Dean' },
                { key: 'is_active', label: 'Active', render: c => c.is_active ? '✅' : '❌' },
              ]}
              onAdd={() => { setColEditing(null); setColForm({ college_name: '', college_code: '', college_campus: '', dean: '', description: '', is_active: true }); setColModal(true); }}
              onEdit={i => { setColEditing(i); setColForm({ college_name: i.college_name, college_code: i.college_code, college_campus: i.college_campus, dean: i.dean, description: i.description, is_active: i.is_active }); setColModal(true); }}
              onDelete={id => handleDelete(id, apiService.deleteCollege.bind(apiService), 'colleges')}
            />
            <FormModal isDark={isDark} isOpen={colModal} onClose={() => setColModal(false)}
              title="College" editing={colEditing} formData={colForm}
              onChange={(k, v) => setColForm(p => ({ ...p, [k]: v }))}
              onSubmit={e => { handleSubmit(e, colEditing, colForm, apiService.createCollege.bind(apiService), apiService.updateCollege.bind(apiService), 'colleges'); setColModal(false); }}
              fields={[
                { key: 'college_name', label: 'College Name', required: true, placeholder: 'e.g. College of Medicine' },
                { key: 'college_code', label: 'Code', placeholder: 'e.g. COM' },
                { key: 'college_campus', label: 'Campus', required: true, type: 'select', options: campuses, displayKey: 'campus_name' },
                { key: 'dean', label: 'Dean', placeholder: 'e.g. Dr. Abebe Kebede' },
                { key: 'description', label: 'Description', placeholder: 'Brief description...' },
                { key: 'is_active', label: 'Active', type: 'checkbox' },
              ]}
            />
          </>
        );

      case 'departments':
        return (
          <>
            <CrudSection
              isDark={isDark} title="Departments" items={departments} loading={deptLoading}
              columns={[
                { key: 'department_name', label: 'Name' },
                { key: 'department_code', label: 'Code' },
                { key: 'college_name', label: 'College', render: d => d.college_name || '—' },
                { key: 'head', label: 'Head' },
                { key: 'is_active', label: 'Active', render: d => d.is_active ? '✅' : '❌' },
              ]}
              onAdd={() => { setDeptEditing(null); setDeptForm({ department_name: '', department_code: '', department_college: '', head: '', description: '', is_active: true }); setDeptModal(true); }}
              onEdit={i => { setDeptEditing(i); setDeptForm({ department_name: i.department_name, department_code: i.department_code, department_college: i.department_college, head: i.head, description: i.description, is_active: i.is_active }); setDeptModal(true); }}
              onDelete={id => handleDelete(id, apiService.deleteDepartment.bind(apiService), 'departments')}
            />
            <FormModal isDark={isDark} isOpen={deptModal} onClose={() => setDeptModal(false)}
              title="Department" editing={deptEditing} formData={deptForm}
              onChange={(k, v) => setDeptForm(p => ({ ...p, [k]: v }))}
              onSubmit={e => { handleSubmit(e, deptEditing, deptForm, apiService.createDepartment.bind(apiService), apiService.updateDepartment.bind(apiService), 'departments'); setDeptModal(false); }}
              fields={[
                { key: 'department_name', label: 'Department Name', required: true, placeholder: 'e.g. Computer Science' },
                { key: 'department_code', label: 'Code', placeholder: 'e.g. CS' },
                { key: 'department_college', label: 'College', required: true, type: 'select', options: colleges, displayKey: 'college_name' },
                { key: 'head', label: 'Department Head', placeholder: 'e.g. Dr. Tigist Alemu' },
                { key: 'description', label: 'Description', placeholder: 'Brief description...' },
                { key: 'is_active', label: 'Active', type: 'checkbox' },
              ]}
            />
          </>
        );

      case 'resolver-levels':
        return <ResolverLevelManagement />;

      case 'offices':
        return <CategoryManagement />;

      case 'office-assignments':
        return <CategoryResolverManagement />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
        <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <nav className="-mb-px flex space-x-1 px-2 sm:px-4 overflow-x-auto scrollbar-thin">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default InstitutionManagement;
