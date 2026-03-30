import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const Appointments = () => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/appointments/', { headers })
      .then(r => r.json())
      .then(appts => {
      setAppointments(appts.results ?? appts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cardCls = `${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border shadow-sm p-5`;

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('appointments')}</h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('appointment_scheduled_by_officers')}
          </p>
        </div>
      </div>

      {/* Appointments List */}
      {appointments.length === 0 ? (
        <div className={`${cardCls} text-center py-12`}>
          <div className="text-4xl mb-3">📅</div>
          <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('no_appointments_yet')}</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            {t('appointments_will_appear')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(appt => (
            <div key={appt.id} className={cardCls}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{appt.complaint_title}</p>
                  <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span>📅 {new Date(appt.scheduled_at).toLocaleString()}</span>
                    {appt.location && <span>📍 {appt.location}</span>}
                    {appt.officer && <span>👤 {appt.officer.first_name} {appt.officer.last_name}</span>}
                  </div>
                  {appt.note && <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{appt.note}</p>}
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[appt.status]}`}>
                  {appt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Appointments;
