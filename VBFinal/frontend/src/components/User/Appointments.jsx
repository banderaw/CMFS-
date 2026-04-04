import { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const Appointments = () => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const appts = await apiService.getAppointments();
        setAppointments(appts.results ?? appts ?? []);
      } catch {
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    loadAppointments();
  }, []);

  const cardCls = `${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border shadow-sm p-5`;

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('appointments')}</h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('appointment_scheduled_by_officers')}
          </p>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className={`${cardCls} text-center py-12`}>
          <div className="text-4xl mb-3">ðŸ“…</div>
          <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('no_appointments_yet')}</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            {t('appointments_will_appear')}
          </p>
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
                    {appointment.officer && <span>ðŸ‘¤ {appointment.officer.first_name} {appointment.officer.last_name}</span>}
                  </div>
                  {appointment.note && <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{appointment.note}</p>}
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[appointment.status]}`}>
                  {appointment.status}
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
