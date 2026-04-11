import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useMaintenanceMode } from '../../contexts/MaintenanceContext';
import apiService from '../../services/api';
import systemLogger from '../../services/systemLogger';

const MAINTENANCE_SCHEDULE_STORAGE_KEY = 'cmfs_maintenance_schedules_v1';

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const getDurationMinutes = (startIso, endIso, fallback = 30) => {
  if (!startIso || !endIso) return fallback;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return fallback;
  return Math.max(1, Math.round((end - start) / 60000));
};

const parseStoredSchedules = () => {
  try {
    const raw = localStorage.getItem(MAINTENANCE_SCHEDULE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};


const SystemManagement = () => {
  const { isDark } = useTheme();
  const {
    isMaintenanceMode,
    maintenanceEndTime,
    maintenanceMessage: currentMaintenanceMessage,
    enableMaintenanceMode,
    disableMaintenanceMode,
    updateMaintenanceConfiguration,
    scheduleMaintenanceMode
  } = useMaintenanceMode();
  const [activeSystemTab, setActiveSystemTab] = useState('overview');
  const [systemStats, setSystemStats] = useState({
    uptime: '0 days',
    totalComplaints: 0,
    activeUsers: 0,
    database: {
      size: 'N/A',
      active_connections: 0,
      total_queries: 0
    },
    django: {
      total_complaints: 0,
      pending_complaints: 0,
      total_users: 0,
      active_users: 0,
      recent_complaints: 0
    },
    system_info: {
      django_version: 'Loading...',
      python_version: 'Loading...',
      os_info: 'Loading...',
      database: { vendor: 'Loading...', version: 'Loading...' },
      uptime: 'Loading...',
      environment: 'Loading...'
    }
  });
  const [backupStatus, setBackupStatus] = useState('Last backup: Never');
  const [loading, setLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [systemLogs, setSystemLogs] = useState([]);
  const [logStats, setLogStats] = useState({
    total: 0,
    info: 0,
    warn: 0,
    error: 0,
    success: 0,
  });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [logLevelFilter, setLogLevelFilter] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [hasNextLogPage, setHasNextLogPage] = useState(false);
  const [hasPreviousLogPage, setHasPreviousLogPage] = useState(false);
  const [scheduledMaintenanceTime, setScheduledMaintenanceTime] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState('System is under maintenance. Please try again later.');
  const [maintenanceDuration, setMaintenanceDuration] = useState(30);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState([]);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [jwtSessionTimeout, setJwtSessionTimeout] = useState(30);
  const [availableTimeouts, setAvailableTimeouts] = useState([15, 30, 60, 120, 240]);

  const systemTabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'maintenance', name: 'Maintenance', icon: '🔧' },
    { id: 'backup', name: 'Backup & Restore', icon: '💾' },
    { id: 'logs', name: 'System Logs', icon: '📋' },
    { id: 'security', name: 'Security & Configuration', icon: '🔒' }
  ];

  const loadSystemStats = useCallback(async () => {
    try {
      const [complaintsData, usersData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getAllUsers()
      ]);

      const complaints = complaintsData.results || complaintsData;
      const users = usersData.results || usersData;

      setSystemStats((prev) => ({
        ...prev,
        totalComplaints: complaints.length,
        activeUsers: users.length
      }));
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  }, []);

  const loadJwtConfig = useCallback(async () => {
    try {
      const response = await apiService.getJwtConfig();
      if (response) {
        setJwtSessionTimeout(response.session_timeout_minutes);
        setAvailableTimeouts(response.available_options);
      }
    } catch (error) {
      console.error('Failed to load JWT config:', error);
    }
  }, []);

  useEffect(() => {
    loadSystemStats();

    loadJwtConfig();

    return () => {
    };
  }, [loadJwtConfig, loadSystemStats]);

  useEffect(() => {
    setMaintenanceMessage(currentMaintenanceMessage || 'System is under maintenance. Please try again later.');
  }, [currentMaintenanceMessage]);

  useEffect(() => {
    setMaintenanceSchedules(parseStoredSchedules());
  }, []);

  useEffect(() => {
    localStorage.setItem(MAINTENANCE_SCHEDULE_STORAGE_KEY, JSON.stringify(maintenanceSchedules));
  }, [maintenanceSchedules]);

  useEffect(() => {
    if (!maintenanceEndTime) {
      return;
    }

    const hasExisting = maintenanceSchedules.some((schedule) => schedule.source === 'backend-live');
    if (hasExisting) {
      return;
    }

    const startIso = new Date().toISOString();
    const durationMinutes = getDurationMinutes(startIso, maintenanceEndTime, maintenanceDuration);

    setMaintenanceSchedules((prev) => [
      {
        id: `backend-live-${Date.now()}`,
        source: 'backend-live',
        title: 'Active Maintenance Window',
        scheduled_start: startIso,
        scheduled_end: maintenanceEndTime,
        message: currentMaintenanceMessage || maintenanceMessage,
        duration_minutes: durationMinutes,
        status: 'active',
      },
      ...prev,
    ]);
  }, [currentMaintenanceMessage, maintenanceDuration, maintenanceEndTime, maintenanceMessage, maintenanceSchedules]);

  // Real-time system stats from backend
  const updateJwtTimeout = async (timeoutMinutes) => {
    try {
      const response = await apiService.updateJwtTimeout(timeoutMinutes);
      if (response.success) {
        setJwtSessionTimeout(timeoutMinutes);
        alert(response.message);
      }
    } catch (error) {
      console.error('Failed to update JWT timeout:', error);
      alert('Failed to update session timeout');
    }
  };

  const loadSystemLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const data = await apiService.getSystemLogs({
        limit: 100,
        level: logLevelFilter,
        category: logCategoryFilter,
        page: logPage,
      });

      if (Array.isArray(data?.results)) {
        setSystemLogs(data.results);
        setLogCount(data.count ?? data.results.length);
        setHasNextLogPage(Boolean(data.next));
        setHasPreviousLogPage(Boolean(data.previous));
        setLogStats({
          total: data.stats?.total ?? data.count ?? data.results.length,
          info: data.stats?.info ?? 0,
          warn: data.stats?.warn ?? 0,
          error: data.stats?.error ?? 0,
          success: data.stats?.success ?? 0,
        });
      } else {
        const normalized = Array.isArray(data) ? data : [];
        setSystemLogs(normalized);
        setLogCount(normalized.length);
        setHasNextLogPage(false);
        setHasPreviousLogPage(false);
        setLogStats({
          total: normalized.length,
          info: normalized.filter((log) => log.level === 'INFO').length,
          warn: normalized.filter((log) => log.level === 'WARN').length,
          error: normalized.filter((log) => log.level === 'ERROR').length,
          success: normalized.filter((log) => log.level === 'SUCCESS').length,
        });
      }
    } catch (error) {
      console.error('Failed to load system logs:', error);
      setSystemLogs([]);
      setLogCount(0);
      setHasNextLogPage(false);
      setHasPreviousLogPage(false);
      setLogStats({
        total: 0,
        info: 0,
        warn: 0,
        error: 0,
        success: 0,
      });
      setLogsError(error.message || 'Failed to load system logs');
    } finally {
      setLogsLoading(false);
    }
  }, [logLevelFilter, logCategoryFilter, logPage]);

  useEffect(() => {
    loadSystemLogs();
  }, [loadSystemLogs]);

  const handleBackup = async (backupType = 'full') => {
    setLoading(true);
    setBackupProgress(0);

    systemLogger.info(`Starting ${backupType} backup`, 'BACKUP');

    try {
      // Simulate backup progress
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Create backup data
      const [complaintsData, usersData, categoriesData, institutionsData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getAllUsers(),
        apiService.getCategories(),
        apiService.getInstitutions()
      ]);

      const backupData = {
        timestamp: new Date().toISOString(),
        type: backupType,
        data: {
          complaints: complaintsData.results || complaintsData,
          users: usersData.results || usersData,
          categories: categoriesData.results || categoriesData,
          institutions: institutionsData.results || institutionsData
        },
        metadata: {
          version: '1.0',
          totalRecords: (complaintsData.results || complaintsData).length +
            (usersData.results || usersData).length +
            (categoriesData.results || categoriesData).length +
            (institutionsData.results || institutionsData).length
        }
      };

      // Simulate backup completion
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBackupProgress(100);

      // Download backup file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cmfs-backup-${backupType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupStatus(`Last backup: ${new Date().toLocaleString()}`);

      systemLogger.success(`${backupType.charAt(0).toUpperCase() + backupType.slice(1)} backup completed successfully (${(blob.size / 1024).toFixed(1)} KB, ${backupData.metadata.totalRecords} records)`, 'BACKUP');
      alert(`${backupType.charAt(0).toUpperCase() + backupType.slice(1)} backup completed successfully!`);
    } catch (error) {
      systemLogger.error(`Backup failed: ${error.message}`, 'BACKUP');
      alert('Backup failed: ' + error.message);
    } finally {
      setLoading(false);
      setBackupProgress(0);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      alert('Please select a backup file to restore');
      return;
    }

    if (!confirm('Are you sure you want to restore from backup? This will overwrite existing data.')) {
      return;
    }

    setLoading(true);
    setRestoreProgress(0);
    systemLogger.info('Starting restore from backup', 'RESTORE');

    try {
      const progressInterval = setInterval(() => {
        setRestoreProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // Read and parse backup file
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(restoreFile);
      });

      const backupData = JSON.parse(fileContent);

      // Validate backup format
      if (!backupData.data || !backupData.timestamp) {
        clearInterval(progressInterval);
        throw new Error('Invalid backup file format');
      }

      systemLogger.info(`Restoring ${backupData.metadata?.totalRecords || 0} records`, 'RESTORE');

      // Restore data to backend
      let restoredCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errors = [];

      // Restore institutions first (categories depend on them)
      if (backupData.data.institutions && backupData.data.institutions.length > 0) {
        systemLogger.info(`Restoring ${backupData.data.institutions.length} institutions`, 'RESTORE');
        for (const institution of backupData.data.institutions) {
          try {
            const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...institutionData } = institution;
            await apiService.createInstitution(institutionData);
            restoredCount++;
          } catch (error) {
            const errorMsg = error.response?.data || error.message;
            if (errorMsg?.name?.[0]?.includes('already exists') || error.response?.status === 400) {
              skippedCount++;
              systemLogger.info(`Institution already exists, skipping: ${institution.name}`, 'RESTORE');
            } else {
              errorCount++;
              errors.push(`Institution "${institution.name}": ${JSON.stringify(errorMsg)}`);
              console.error('Failed to restore institution:', institution.name, errorMsg);
            }
          }
        }
      }

      // Restore categories
      if (backupData.data.categories && backupData.data.categories.length > 0) {
        systemLogger.info(`Restoring ${backupData.data.categories.length} categories`, 'RESTORE');
        for (const category of backupData.data.categories) {
          try {
            const {
              category_id: _categoryId,
              id: _id,
              created_at: _createdAt,
              updated_at: _updatedAt,
              institution_name: _institutionName,
              parent_name: _parentName,
              ...categoryData
            } = category;

            // Validate required fields
            if (!categoryData.name) {
              throw new Error('Category name is required');
            }
            if (!categoryData.institution) {
              throw new Error('Institution is required');
            }

            await apiService.createCategory(categoryData);
            restoredCount++;
          } catch (error) {
            const errorMsg = error.response?.data || error.message;
            if (errorMsg?.name?.[0]?.includes('already exists') || (typeof errorMsg === 'object' && JSON.stringify(errorMsg).includes('already exists'))) {
              skippedCount++;
              systemLogger.info(`Category already exists, skipping: ${category.name}`, 'RESTORE');
            } else {
              errorCount++;
              errors.push(`Category "${category.name}": ${JSON.stringify(errorMsg)}`);
              console.error('Failed to restore category:', category.name, errorMsg);
            }
          }
        }
      }

      clearInterval(progressInterval);
      setRestoreProgress(100);

      systemLogger.success(`Restore completed: ${restoredCount} restored, ${skippedCount} skipped, ${errorCount} errors`, 'RESTORE');

      let message = `Restore completed!\n\n✓ Restored: ${restoredCount} records\n⊘ Skipped (duplicates): ${skippedCount}\n✗ Errors: ${errorCount}\n\nFrom backup: ${new Date(backupData.timestamp).toLocaleString()}`;

      if (errors.length > 0) {
        message += `\n\nError details (check console for full details):\n${errors.slice(0, 3).join('\n')}`;
        if (errors.length > 3) {
          message += `\n... and ${errors.length - 3} more errors`;
        }
      }

      message += '\n\nNote: Users and complaints were not restored for security reasons.';

      alert(message);

      // Reset file input
      setRestoreFile(null);
      const fileInput = document.getElementById('restore-file-input');
      if (fileInput) fileInput.value = '';

      // Reload data to show restored items
      await loadSystemStats();

    } catch (error) {
      systemLogger.error(`Restore failed: ${error.message}`, 'RESTORE');
      alert('Restore failed: ' + error.message);
    } finally {
      setLoading(false);
      setRestoreProgress(0);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('Please select a valid JSON backup file');
        return;
      }
      setRestoreFile(file);
    }
  };

  const handleMaintenanceToggle = async () => {
    if (isMaintenanceMode) {
      if (confirm('Are you sure you want to disable maintenance mode? Users will be able to access the system.')) {
        try {
          await disableMaintenanceMode();
          systemLogger.info('Maintenance mode disabled by admin', 'MAINTENANCE');
          alert('Maintenance mode disabled. System is now accessible to all users.');
        } catch (error) {
          alert(`Failed to disable maintenance mode: ${error.message}`);
        }
      }
    } else {
      if (confirm(`Are you sure you want to enable maintenance mode for ${maintenanceDuration} minutes? This will prevent non-admin users from accessing the system.`)) {
        try {
          await enableMaintenanceMode(maintenanceMessage, maintenanceDuration);
          systemLogger.warn(`Maintenance mode enabled by admin for ${maintenanceDuration} minutes`, 'MAINTENANCE');
          alert(`Maintenance mode enabled for ${maintenanceDuration} minutes. Only administrators can access the system.`);
        } catch (error) {
          alert(`Failed to enable maintenance mode: ${error.message}`);
        }
      }
    }
  };

  const handleScheduleMaintenance = async () => {
    if (!scheduledMaintenanceTime) {
      alert('Please select a date and time for scheduled maintenance.');
      return;
    }

    const scheduledTime = new Date(scheduledMaintenanceTime);
    const now = new Date();

    if (scheduledTime <= now) {
      alert('Please select a future date and time.');
      return;
    }

    const nextSchedule = {
      id: editingScheduleId || `schedule-${Date.now()}`,
      source: 'local',
      title: `Scheduled Maintenance (${maintenanceDuration} min)`,
      scheduled_start: scheduledTime.toISOString(),
      scheduled_end: new Date(scheduledTime.getTime() + maintenanceDuration * 60 * 1000).toISOString(),
      message: maintenanceMessage,
      duration_minutes: maintenanceDuration,
      status: 'scheduled',
    };

    setMaintenanceSchedules((prev) => {
      if (!editingScheduleId) {
        return [nextSchedule, ...prev].sort(
          (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
        );
      }
      return prev
        .map((item) => (item.id === editingScheduleId ? nextSchedule : item))
        .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
    });

    setScheduledMaintenanceTime('');
    setEditingScheduleId(null);
    alert(editingScheduleId ? 'Maintenance schedule updated.' : 'Maintenance schedule saved.');
  };

  const handleEditSchedule = (schedule) => {
    setEditingScheduleId(schedule.id);
    setScheduledMaintenanceTime(toDateTimeLocalValue(schedule.scheduled_start));
    setMaintenanceDuration(schedule.duration_minutes || getDurationMinutes(schedule.scheduled_start, schedule.scheduled_end, 30));
    setMaintenanceMessage(schedule.message || 'System is under maintenance. Please try again later.');
    setActiveSystemTab('maintenance');
  };

  const handleDeleteSchedule = (scheduleId) => {
    if (!confirm('Delete this maintenance schedule?')) {
      return;
    }
    setMaintenanceSchedules((prev) => prev.filter((item) => item.id !== scheduleId));
    if (editingScheduleId === scheduleId) {
      setEditingScheduleId(null);
      setScheduledMaintenanceTime('');
    }
  };

  const handleApplySchedule = async (schedule) => {
    try {
      await scheduleMaintenanceMode(
        schedule.scheduled_start,
        schedule.message,
        schedule.duration_minutes || getDurationMinutes(schedule.scheduled_start, schedule.scheduled_end, 30)
      );

      setMaintenanceSchedules((prev) =>
        prev.map((item) => ({
          ...item,
          status: item.id === schedule.id ? 'applied' : item.status,
        }))
      );

      alert(`Scheduled maintenance synced to backend for ${new Date(schedule.scheduled_start).toLocaleString()}.`);
    } catch (error) {
      alert(`Failed to apply schedule: ${error.message}`);
    }
  };

  const handleRunScheduleNow = async (schedule) => {
    try {
      const duration = schedule.duration_minutes || getDurationMinutes(schedule.scheduled_start, schedule.scheduled_end, 30);
      await enableMaintenanceMode(schedule.message, duration);
      setMaintenanceSchedules((prev) =>
        prev.map((item) => ({
          ...item,
          status: item.id === schedule.id ? 'active' : item.status,
        }))
      );
      alert('Maintenance started immediately using selected schedule.');
    } catch (error) {
      alert(`Failed to start maintenance now: ${error.message}`);
    }
  };

  const handleCancelBackendSchedule = async () => {
    if (!confirm('Cancel the currently configured backend maintenance schedule?')) {
      return;
    }

    try {
      await updateMaintenanceConfiguration({
        is_enabled: false,
        scheduled_start: null,
        scheduled_end: null,
      });
      alert('Backend maintenance schedule cancelled.');
    } catch (error) {
      alert(`Failed to cancel backend schedule: ${error.message}`);
    }
  };

  const renderSystemOverview = () => (
    <div className="space-y-6">
      {/* System Overview */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-green-500">{systemStats.django.total_complaints || systemStats.totalComplaints}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Complaints</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              {systemStats.django.pending_complaints || 0} pending
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-blue-500">{systemStats.django.active_users || systemStats.activeUsers}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Users</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              {systemStats.django.total_users || 0} total
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-purple-500">{systemStats.uptime}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>System Uptime</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              {systemStats.django.recent_complaints || 0} recent complaints
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMaintenance = () => (
    <div className="space-y-6">
      {/* Maintenance Mode Status */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Maintenance Mode Status
        </h3>
        <div className={`p-4 rounded-lg border-2 ${isMaintenanceMode
          ? isDark ? 'border-red-500 bg-red-900/20' : 'border-red-300 bg-red-50'
          : isDark ? 'border-green-500 bg-green-900/20' : 'border-green-300 bg-green-50'
          }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`text-3xl ${isMaintenanceMode ? 'animate-pulse' : ''}`}>
                {isMaintenanceMode ? '🚫' : '✅'}
              </div>
              <div>
                <div className={`font-medium ${isMaintenanceMode ? 'text-red-600' : 'text-green-600'
                  }`}>
                  Maintenance Mode: {isMaintenanceMode ? 'ENABLED' : 'DISABLED'}
                </div>
                <div className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isMaintenanceMode
                    ? 'Only administrators can access the system'
                    : 'System is accessible to all users'
                  }
                </div>
                {isMaintenanceMode && maintenanceEndTime && (
                  <div className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                    Auto-disable: {new Date(maintenanceEndTime).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleMaintenanceToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isMaintenanceMode
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-red-500 text-white hover:bg-red-600'
                }`}
            >
              {isMaintenanceMode ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Duration */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Maintenance Duration
        </h3>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Duration (minutes)
            </label>
            <select
              value={maintenanceDuration}
              onChange={(e) => setMaintenanceDuration(parseInt(e.target.value))}
              disabled={isMaintenanceMode}
              className={`w-full p-3 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} disabled:opacity-50`}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
            </select>
            <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Maintenance mode will automatically disable after this duration
            </p>
          </div>
        </div>
      </div>

      {/* Maintenance Message */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Maintenance Message
        </h3>
        <div className="space-y-4">
          <textarea
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            className={`w-full p-3 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            rows="3"
            placeholder="Enter message to display to users during maintenance..."
          />
          <button
            onClick={async () => {
              if (isMaintenanceMode) {
                try {
                  await updateMaintenanceConfiguration({ message: maintenanceMessage });
                  alert('Maintenance message updated!');
                } catch (error) {
                  alert(`Failed to update maintenance message: ${error.message}`);
                }
              }
            }}
            disabled={!isMaintenanceMode}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Message
          </button>
        </div>
      </div>

      {/* Schedule Maintenance */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Schedule Maintenance
        </h3>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Scheduled Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledMaintenanceTime}
              onChange={(e) => setScheduledMaintenanceTime(e.target.value)}
              className={`w-full p-3 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleScheduleMaintenance}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              {editingScheduleId ? 'Update Schedule' : 'Add Schedule'}
            </button>
            {editingScheduleId && (
              <button
                onClick={() => {
                  setEditingScheduleId(null);
                  setScheduledMaintenanceTime('');
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel Edit
              </button>
            )}
            <button
              onClick={handleCancelBackendSchedule}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Cancel Backend Schedule
            </button>
          </div>
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Maintenance Schedule Manager
        </h3>

        {maintenanceSchedules.length === 0 ? (
          <div className={`p-4 rounded-lg text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
            No schedules yet. Add your first maintenance schedule above.
          </div>
        ) : (
          <div className="space-y-3">
            {maintenanceSchedules
              .slice()
              .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
              .map((schedule) => (
                <div
                  key={schedule.id}
                  className={`p-4 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-700/40' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {schedule.title || 'Maintenance Window'}
                      </div>
                      <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {new Date(schedule.scheduled_start).toLocaleString()} - {new Date(schedule.scheduled_end).toLocaleString()}
                      </div>
                      <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Duration: {schedule.duration_minutes || getDurationMinutes(schedule.scheduled_start, schedule.scheduled_end, 30)} min | Source: {schedule.source === 'backend-live' ? 'Backend' : 'Local'}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${schedule.status === 'active'
                      ? 'bg-red-100 text-red-700'
                      : schedule.status === 'applied'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                      }`}>
                      {(schedule.status || 'scheduled').toUpperCase()}
                    </span>
                  </div>

                  <div className={`text-sm mt-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {schedule.message}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleApplySchedule(schedule)}
                      className="px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 text-sm"
                    >
                      Apply to Backend
                    </button>
                    <button
                      onClick={() => handleRunScheduleNow(schedule)}
                      className="px-3 py-1.5 rounded bg-orange-500 text-white hover:bg-orange-600 text-sm"
                    >
                      Run Now
                    </button>
                    <button
                      onClick={() => handleEditSchedule(schedule)}
                      className="px-3 py-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="px-3 py-1.5 rounded bg-rose-500 text-white hover:bg-rose-600 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Actions
        </h3>
        <div className={`p-4 rounded-lg text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
          Service-level actions are now managed from the backend. This panel focuses on maintenance, logs, sessions, and configuration.
        </div>
      </div>
    </div >
  );

  const renderBackupRestore = () => (
    <div className="space-y-6">
      {/* Backup Section */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Create Backup
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleBackup('full')}
            disabled={loading}
            className={`flex flex-col items-center p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-blue-50'
              }`}
          >
            <div className="text-3xl mb-2">💾</div>
            <div className="font-medium text-blue-600">Full Backup</div>
            <div className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>All data & settings</div>
          </button>

          <button
            onClick={() => handleBackup('data')}
            disabled={loading}
            className={`flex flex-col items-center p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-green-50'
              }`}
          >
            <div className="text-3xl mb-2">📊</div>
            <div className="font-medium text-green-600">Data Only</div>
            <div className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Complaints & users</div>
          </button>

          <button
            onClick={() => handleBackup('config')}
            disabled={loading}
            className={`flex flex-col items-center p-4 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-purple-50'
              }`}
          >
            <div className="text-3xl mb-2">⚙️</div>
            <div className="font-medium text-purple-600">Config Only</div>
            <div className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Settings & categories</div>
          </button>
        </div>

        {/* Backup Progress */}
        {backupProgress > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Backup Progress</span>
              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{backupProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${backupProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          {backupStatus}
        </div>
      </div>

      {/* Restore Section */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Restore from Backup
        </h3>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Select Backup File
            </label>
            <input
              id="restore-file-input"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className={`block w-full text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'} border ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-lg cursor-pointer focus:outline-none`}
            />
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Select a JSON backup file to restore
            </p>
          </div>

          {restoreFile && (
            <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex items-center space-x-2">
                <span className="text-lg">📄</span>
                <div>
                  <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {restoreFile.name}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(restoreFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleRestore}
            disabled={loading || !restoreFile}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>🔄</span>
            <span>Restore from Backup</span>
          </button>

          {/* Restore Progress */}
          {restoreProgress > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Restore Progress</span>
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{restoreProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${restoreProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSystemLogs = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            System Logs
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={loadSystemLogs}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <select
            value={logLevelFilter}
            onChange={(e) => {
              setLogPage(1);
              setLogLevelFilter(e.target.value);
            }}
            className={`p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          >
            <option value="">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="SUCCESS">SUCCESS</option>
          </select>

          <input
            type="text"
            value={logCategoryFilter}
            onChange={(e) => {
              setLogPage(1);
              setLogCategoryFilter(e.target.value.trim().toUpperCase());
            }}
            placeholder="Filter by category (e.g. REQUEST)"
            className={`p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          />

          <div className={`p-2 rounded text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
            Showing {systemLogs.length} of {logCount}
          </div>
        </div>

        {/* Log Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-lg font-bold text-blue-500">{logStats.total}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Logs</div>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-lg font-bold text-red-500">{logStats.error}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Errors</div>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-lg font-bold text-yellow-500">{logStats.warn}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Warnings</div>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-lg font-bold text-green-500">{logStats.success}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Success</div>
          </div>
        </div>

        {logsError && (
          <div className={`mb-4 p-3 rounded ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
            {logsError}
          </div>
        )}

        <div className={`${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto`}>
          {logsLoading ? (
            <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'} py-4`}>
              Loading logs...
            </div>
          ) : systemLogs.length === 0 ? (
            <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'} py-4`}>
              No system logs available
            </div>
          ) : (
            <div className="space-y-1">
              {systemLogs.map((log, index) => (
                <div key={log.id || index} className={`flex items-start space-x-3 py-1 ${log.level === 'ERROR' ? isDark ? 'text-red-400' : 'text-red-600' :
                  log.level === 'WARN' ? isDark ? 'text-yellow-400' : 'text-yellow-600' :
                    log.level === 'SUCCESS' ? isDark ? 'text-green-400' : 'text-green-600' :
                      log.level === 'INFO' ? isDark ? 'text-blue-400' : 'text-blue-600' :
                        isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  <span className={`inline-block w-16 text-xs px-2 py-1 rounded ${log.level === 'ERROR' ? 'bg-red-100 text-red-800' :
                    log.level === 'WARN' ? 'bg-yellow-100 text-yellow-800' :
                      log.level === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                        log.level === 'INFO' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                    }`}>
                    {log.level}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} w-32 flex-shrink-0`}>
                    {new Date(log.created_at || log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} w-20 flex-shrink-0`}>
                    [{log.category || 'SYSTEM'}]
                  </span>
                  <span className="flex-1">
                    {log.message}
                  </span>
                  {log.user && log.user !== 'system' && (
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} flex-shrink-0`}>
                      by {log.user}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setLogPage((prev) => Math.max(1, prev - 1))}
            disabled={!hasPreviousLogPage || logsLoading}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Previous
          </button>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Page {logPage}</span>
          <button
            onClick={() => setLogPage((prev) => prev + 1)}
            disabled={!hasNextLogPage || logsLoading}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Security & Configuration
        </h3>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              JWT Session Timeout
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={jwtSessionTimeout}
                onChange={(e) => setJwtSessionTimeout(parseInt(e.target.value, 10))}
                className={`w-full sm:w-72 p-3 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                {availableTimeouts.map((timeout) => (
                  <option key={timeout} value={timeout}>
                    {timeout} minutes
                  </option>
                ))}
              </select>
              <button
                onClick={() => updateJwtTimeout(jwtSessionTimeout)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Update Timeout
              </button>
            </div>
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Changes apply to new sessions and help enforce consistent admin session security.
          </p>
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-sm font-medium text-gray-600">Environment</div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {systemStats.system_info.environment}
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-sm font-medium text-gray-600">Operating System</div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {systemStats.system_info.os_info}
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-sm font-medium text-gray-600">Django Version</div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {systemStats.system_info.django_version}
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-sm font-medium text-gray-600">Python Version</div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {systemStats.system_info.python_version}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeSystemTab) {
      case 'overview':
        return renderSystemOverview();
      case 'maintenance':
        return renderMaintenance();
      case 'backup':
        return renderBackupRestore();
      case 'logs':
        return renderSystemLogs();
      case 'security':
        return renderSecurity();
      default:
        return renderMaintenance();
    }
  };

  return (
    <div className="space-y-6">
      {/* System Tabs */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto px-6">
            {systemTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSystemTab(tab.id)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeSystemTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} hover:border-gray-300`
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
};

export default SystemManagement;
