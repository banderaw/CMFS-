import { useMemo } from 'react';
import { useMaintenanceMode } from '../contexts/MaintenanceContext';
import { useTheme } from '../contexts/ThemeContext';

const MaintenancePage = ({ message }) => {
  const { isDark } = useTheme();
  const {
    maintenanceMessage,
    maintenanceEndTime,
    loading,
    refreshMaintenanceStatus,
  } = useMaintenanceMode();

  const displayMessage = message || maintenanceMessage;

  const maintenanceMeta = useMemo(() => {
    if (!maintenanceEndTime) {
      return 'Please check back shortly. We apologize for any inconvenience.';
    }

    const endDate = new Date(maintenanceEndTime);
    if (Number.isNaN(endDate.getTime())) {
      return 'Please check back shortly. We apologize for any inconvenience.';
    }

    return `Estimated completion: ${endDate.toLocaleString()}`;
  }, [maintenanceEndTime]);

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className={`max-w-md w-full mx-4 p-8 rounded-lg shadow-lg text-center ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="text-6xl mb-6">🔧</div>
        <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          System Under Maintenance
        </h1>
        <p className={`text-lg mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {displayMessage || 'We are currently performing scheduled maintenance to improve your experience.'}
        </p>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {maintenanceMeta}
          </p>
        </div>
        <div className="mt-6 space-y-3">
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <button
            type="button"
            onClick={() => refreshMaintenanceStatus()}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:bg-gray-700 disabled:text-gray-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400'}`}
          >
            {loading ? 'Checking status...' : 'Check Again'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
