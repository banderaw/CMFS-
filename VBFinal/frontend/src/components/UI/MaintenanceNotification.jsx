import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useMaintenanceMode } from '../../contexts/MaintenanceContext';

const MaintenanceNotification = () => {
  const { isDark } = useTheme();
  const { scheduledMaintenance } = useMaintenanceMode();
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    setDismissed(false);
  }, [scheduledMaintenance?.time]);

  useEffect(() => {
    if (!scheduledMaintenance?.time) {
      setTimeLeft('');
      return undefined;
    }

    const scheduledTime = new Date(scheduledMaintenance.time);
    const tick = () => {
      const diff = scheduledTime - new Date();
      if (diff <= 0) {
        setTimeLeft('');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h > 0 ? `${h}h ` : ''}${m}m ${s}s`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [scheduledMaintenance?.time]);

  if (!scheduledMaintenance || dismissed) return null;

  const scheduledTime = new Date(scheduledMaintenance.time);

  return (
    <div className={`rounded-xl border-2 p-5 mb-6 shadow-md ${isDark ? 'bg-yellow-900/30 border-yellow-600' : 'bg-yellow-50 border-yellow-400'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl mt-0.5">🔧</span>
          <div>
            <p className={`text-base font-bold ${isDark ? 'text-yellow-200' : 'text-yellow-800'}`}>
              Scheduled Maintenance Announcement
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              The system will undergo maintenance on{' '}
              <span className="font-semibold">{scheduledTime.toLocaleString()}</span>
            </p>
            {scheduledMaintenance.message && (
              <p className={`text-sm mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                {scheduledMaintenance.message}
              </p>
            )}
            {timeLeft && (
              <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold ${isDark ? 'bg-yellow-800 text-yellow-100' : 'bg-yellow-200 text-yellow-900'}`}>
                <span>⏱</span>
                <span>Starts in: {timeLeft}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className={`text-xl leading-none mt-0.5 ${isDark ? 'text-yellow-400 hover:text-yellow-100' : 'text-yellow-500 hover:text-yellow-800'}`}
          title="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default MaintenanceNotification;
