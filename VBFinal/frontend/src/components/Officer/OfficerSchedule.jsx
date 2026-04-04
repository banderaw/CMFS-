import { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-700',
};

const OfficerSchedule = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ complaint: '', scheduled_at: '', location: '', note: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const loadScheduleData = async () => {
      try {
        const [appts, comps] = await Promise.all([
          apiService.getAppointments(),
          apiService.getComplaints(),
        ]);

        const allAppointments = appts.results ?? appts;
        const allComplaints = comps.results ?? comps;

        setAppointments(Array.isArray(allAppointments) ? allAppointments : []);
        setComplaints(
          Array.isArray(allComplaints)
            ? allComplaints.filter(complaint => complaint.assigned_officer?.id === user?.id && complaint.status !== 'closed')
            : []
        );
      } catch {
        setAppointments([]);
        setComplaints([]);
      } finally {
        setLoading(false);
      }
    };

    loadScheduleData();
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const created = await apiService.createAppointment(form);
      setAppointments(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ complaint: '', scheduled_at: '', location: '', note: '' });
    } catch (createError) {
      setError(createError.message || 'Failed to create appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const updated = await apiService.updateAppointmentStatus(id, status);
      setAppointments(prev => prev.map(appointment => appointment.id === id ? updated : appointment));
    } catch {
      // silent
    } finally {
      setUpdatingId(null);
    }
  };

  const cardCls = `${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border shadow-sm p-5`;
  const inputCls = `mt-1 block w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300'
    }`;

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Schedule Appointments</h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Create and manage appointment schedules for your assigned complaints
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Schedule'}
        </button>
      </div>

      {showForm && (
        <div className={cardCls}>
          <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>New Appointment</h3>
          {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {complaints.length === 0 && (
            <p className="mb-3 text-sm text-yellow-600">No assigned complaints available to schedule.</p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Complaint *</label>
              <select required value={form.complaint} onChange={e => setForm(prev => ({ ...prev, complaint: e.target.value }))} className={inputCls}>
                <option value="">Select a complaint</option>
                {complaints.map(complaint => (
                  <option key={complaint.complaint_id} value={complaint.complaint_id}>{complaint.title}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Date & Time *</label>
                <input
                  required
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Location</label>
                <input
                  type="text"
                  placeholder="e.g. Office 204, Admin Block"
                  value={form.location}
                  onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Note</label>
              <textarea
                rows={2}
                placeholder="Instructions or details for the user..."
                value={form.note}
                onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || complaints.length === 0}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting ? 'Scheduling...' : 'Create Appointment'}
            </button>
          </form>
        </div>
      )}

      {appointments.length === 0 ? (
        <div className={`${cardCls} text-center py-12`}>
          <div className="text-4xl mb-3">ðŸ“…</div>
          <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>No appointments scheduled</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Create a schedule for a complaint to notify the user</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(appointment => (
            <div key={appointment.id} className={cardCls}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{appointment.complaint_title}</p>
                  <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span>ðŸ“… {new Date(appointment.scheduled_at).toLocaleString()}</span>
                    {appointment.location && <span>ðŸ“ {appointment.location}</span>}
                    {appointment.requested_by && <span>ðŸ‘¤ Scheduled by {appointment.requested_by.first_name} {appointment.requested_by.last_name}</span>}
                  </div>
                  {appointment.note && <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{appointment.note}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[appointment.status] || 'bg-gray-100 text-gray-700'}`}>
                    {appointment.status}
                  </span>
                  {appointment.status === 'pending' && (
                    <div className="flex gap-1">
                      <button
                        disabled={updatingId === appointment.id}
                        onClick={() => updateStatus(appointment.id, 'confirmed')}
                        className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        disabled={updatingId === appointment.id}
                        onClick={() => updateStatus(appointment.id, 'cancelled')}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {appointment.status === 'confirmed' && (
                    <button
                      disabled={updatingId === appointment.id}
                      onClick={() => updateStatus(appointment.id, 'completed')}
                      className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded disabled:opacity-50"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OfficerSchedule;
