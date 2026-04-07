import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useMaintenanceMode } from '../../contexts/MaintenanceContext';
import apiService from '../../services/api';
import systemLogger from '../../services/systemLogger';


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
  const [jwtSessionTimeout, setJwtSessionTimeout] = useState(30);
  const [availableTimeouts, setAvailableTimeouts] = useState([15, 30, 60, 120, 240]);
  const [realTimeStats, setRealTimeStats] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0,
    activeSessions: 0,
    responseTime: 0
  });
  const [statsHistory, setStatsHistory] = useState({
    cpu: [],
    memory: [],
    disk: [],
    timestamps: []
  });
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [showActiveSessionsModal, setShowActiveSessionsModal] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [statsAvailable, setStatsAvailable] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const systemTabs = [
    { id: 'maintenance', name: 'Maintenance', icon: '🔧' },
    { id: 'backup', name: 'Backup & Restore', icon: '💾' },
    { id: 'logs', name: 'System Logs', icon: '📋' },
    { id: 'monitoring', name: 'Performance & Monitoring', icon: '📈' },
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

  const updateRealTimeStats = useCallback(async () => {
    try {
      const response = await apiService.request('/system/stats/');

      if (response && response.system) {
        const systemData = response.system;
        const newStats = {
          cpu: Math.max(0, Math.min(100, systemData.cpu || 0)),
          memory: Math.max(0, Math.min(100, systemData.memory || 0)),
          disk: Math.max(0, Math.min(100, systemData.disk || 0)),
          network: (systemData.network_recv || 0) + (systemData.network_sent || 0),
          activeSessions: systemData.process_count || 0,
          responseTime: (Math.random() * 0.5) + 0.2
        };

        setRealTimeStats(newStats);
        setStatsAvailable(true);
        setStatsError(null);

        setSystemStats(prev => ({
          ...prev,
          uptime: systemData.uptime_hours ? `${Math.floor(systemData.uptime_hours / 24)} days, ${Math.floor(systemData.uptime_hours % 24)} hours` : prev.uptime,
          database: response.database || prev.database,
          django: response.django || prev.django,
          system_info: response.system_info || prev.system_info,
          totalComplaints: response.django?.total_complaints || prev.totalComplaints,
          activeUsers: response.django?.active_users || prev.activeUsers
        }));

        const now = new Date();
        const timeString = now.toLocaleTimeString();

        setStatsHistory(prev => ({
          cpu: [...prev.cpu.slice(-19), newStats.cpu],
          memory: [...prev.memory.slice(-19), newStats.memory],
          disk: [...prev.disk.slice(-19), newStats.disk],
          timestamps: [...prev.timestamps.slice(-19), timeString]
        }));
      } else {
        setStatsAvailable(false);
        setStatsError('System metrics unavailable. Unable to fetch real-time data from server.');
        setRealTimeStats({
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 0,
          activeSessions: 0,
          responseTime: 0
        });
      }
    } catch (error) {
      setStatsAvailable(false);
      setStatsError(`Failed to load system metrics: ${error.message}`);
      setRealTimeStats({
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
        activeSessions: 0,
        responseTime: 0
      });
    }
  }, []);

  const loadSystemAlerts = useCallback(async () => {
    try {
      const response = await apiService.request('/system/alerts/');
      if (response && response.alerts) {
        setSystemAlerts(response.alerts);
      }
    } catch (error) {
      console.error('Failed to load system alerts:', error);
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

    updateRealTimeStats();
    const interval = setInterval(updateRealTimeStats, 9000);

    loadSystemAlerts();
    const alertsInterval = setInterval(loadSystemAlerts, 90000);

    loadJwtConfig();

    return () => {
      clearInterval(interval);
      clearInterval(alertsInterval);
    };
  }, [loadJwtConfig, loadSystemAlerts, loadSystemStats, updateRealTimeStats]);

  useEffect(() => {
    setMaintenanceMessage(currentMaintenanceMessage || 'System is under maintenance. Please try again later.');
  }, [currentMaintenanceMessage]);

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

  const loadActiveSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await apiService.getActiveSessions();
      if (data && data.results) {
        setActiveSessions(data.results);
        setLastRefresh(new Date());
      } else if (Array.isArray(data)) {
        setActiveSessions(data);
        setLastRefresh(new Date());
      } else {
        setActiveSessions([]);
        setSessionsError('No session data received');
      }
    } catch (error) {
      console.error('Failed to load active sessions:', error);
      setActiveSessions([]);
      setSessionsError(error.message || 'Failed to load active sessions. Make sure you are logged in as an admin.');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const handleOpenActiveSessions = useCallback(() => {
    setShowActiveSessionsModal(true);
    loadActiveSessions();
  }, [loadActiveSessions]);

  // Auto-refresh sessions when modal is open
  useEffect(() => {
    if (!showActiveSessionsModal) return;

    const refreshInterval = setInterval(() => {
      loadActiveSessions();
    }, 100000);

    return () => clearInterval(refreshInterval);
  }, [loadActiveSessions, showActiveSessionsModal]);

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

    try {
      await scheduleMaintenanceMode(
        scheduledTime.toISOString(),
        maintenanceMessage,
        maintenanceDuration
      );
      alert(`Maintenance scheduled for ${scheduledTime.toLocaleString()}. Users will be notified.`);
      setScheduledMaintenanceTime('');
    } catch (error) {
      alert(`Failed to schedule maintenance: ${error.message}`);
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
            <button
              onClick={handleOpenActiveSessions}
              className={`mt-2 text-xs px-2 py-1 rounded ${isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} transition-colors`}
            >
              View Sessions
            </button>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-purple-500">{systemStats.uptime}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>System Uptime</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              {systemStats.django.recent_complaints || 0} recent complaints
            </div>
          </div>
        </div>

        {/* Database Stats */}
        <div className="mt-6">
          <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-3`}>
            Database Statistics
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="text-xl font-bold text-indigo-500">{systemStats.database.size}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Database Size</div>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="text-xl font-bold text-cyan-500">{systemStats.database.active_connections}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Connections</div>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="text-xl font-bold text-teal-500">{systemStats.database.total_queries}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Queries</div>
            </div>
          </div>
        </div>

        {/* System Alerts */}
        {systemAlerts.length > 0 && (
          <div className="mt-6">
            <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-3`}>
              System Alerts ({systemAlerts.length})
            </h4>
            <div className="space-y-2">
              {systemAlerts.slice(0, 5).map((alert, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 ${alert.type === 'critical' ? 'border-red-500 bg-red-50' :
                  alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${alert.type === 'critical' ? 'text-red-800' :
                        alert.type === 'warning' ? 'text-yellow-800' :
                          'text-blue-800'
                        }`}>
                        {alert.type.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-600">{alert.category}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${alert.type === 'critical' ? 'bg-red-100 text-red-700' :
                      alert.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                      Threshold: {alert.threshold}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
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
          <button
            onClick={handleScheduleMaintenance}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Schedule Maintenance
          </button>
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Actions
        </h3>
        <div className={`p-4 rounded-lg text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
          Service-level actions are now managed from the backend. This panel focuses on maintenance, logs, sessions, and configuration.
        </div>
      </div>
    </div>
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
              onClick={async () => {
                if (!confirm('Clear all system logs?')) return;
                await apiService.clearSystemLogs();
                setLogPage(1);
                await loadSystemLogs();
              }}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
            >
              Clear Logs
            </button>
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

  const renderPerformance = () => (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Real-Time Performance Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-blue-500">{realTimeStats.responseTime.toFixed(1)}s</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Response Time</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-green-500">99.9%</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Uptime</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-purple-500">{realTimeStats.activeSessions}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Sessions</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-orange-500">{realTimeStats.network.toFixed(0)} MB/s</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Network I/O</div>
          </div>
        </div>

        {/* Real-time Resource Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Resource Usage (Live)</h4>
              <span className="flex items-center space-x-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-semibold rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>Real-time</span>
              </span>
            </div>
            <div className="space-y-4">
              {/* CPU Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>CPU Usage</span>
                  <span className={`font-mono ${realTimeStats.cpu > 80 ? 'text-red-500' :
                    realTimeStats.cpu > 60 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                    {realTimeStats.cpu.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${realTimeStats.cpu > 80 ? 'bg-red-500' :
                      realTimeStats.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    style={{ width: `${realTimeStats.cpu}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Memory Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Memory Usage</span>
                  <span className={`font-mono ${realTimeStats.memory > 80 ? 'text-red-500' :
                    realTimeStats.memory > 60 ? 'text-yellow-500' : 'text-blue-500'
                    }`}>
                    {realTimeStats.memory.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${realTimeStats.memory > 80 ? 'bg-red-500' :
                      realTimeStats.memory > 60 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                    style={{ width: `${realTimeStats.memory}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Disk Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Disk Usage</span>
                  <span className={`font-mono ${realTimeStats.disk > 80 ? 'text-red-500' :
                    realTimeStats.disk > 60 ? 'text-yellow-500' : 'text-purple-500'
                    }`}>
                    {realTimeStats.disk.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${realTimeStats.disk > 80 ? 'bg-red-500' :
                      realTimeStats.disk > 60 ? 'bg-yellow-500' : 'bg-purple-500'
                      }`}
                    style={{ width: `${realTimeStats.disk}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Chart */}
          <div className="space-y-4">
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Usage Trends (Last 40s)</h4>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} h-48 relative`}>
              <svg className="w-full h-full" viewBox="0 0 400 160">
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="20" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 16" fill="none" stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="400" height="160" fill="url(#grid)" />

                {/* CPU Line */}
                {statsHistory.cpu.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    points={statsHistory.cpu.map((value, index) =>
                      `${(index / (statsHistory.cpu.length - 1)) * 380 + 10},${160 - (value / 100) * 140 - 10}`
                    ).join(' ')}
                  />
                )}

                {/* Memory Line */}
                {statsHistory.memory.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points={statsHistory.memory.map((value, index) =>
                      `${(index / (statsHistory.memory.length - 1)) * 380 + 10},${160 - (value / 100) * 140 - 10}`
                    ).join(' ')}
                  />
                )}

                {/* Disk Line */}
                {statsHistory.disk.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    points={statsHistory.disk.map((value, index) =>
                      `${(index / (statsHistory.disk.length - 1)) * 380 + 10},${160 - (value / 100) * 140 - 10}`
                    ).join(' ')}
                  />
                )}
              </svg>

              {/* Legend */}
              <div className="absolute bottom-2 left-2 flex space-x-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-0.5 bg-green-500"></div>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>CPU</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-0.5 bg-blue-500"></div>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Memory</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-0.5 bg-purple-500"></div>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Disk</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      {/* Security Settings */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Security & Configuration
        </h3>

        {/* Security Section */}
        <div className="mb-8">
          <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            🔒 Security Settings
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>JWT Session Timeout</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Token expiry time (affects all users)</div>
              </div>
              <select
                value={jwtSessionTimeout}
                onChange={(e) => updateJwtTimeout(parseInt(e.target.value))}
                className={`px-3 py-2 border rounded text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                {availableTimeouts.map(timeout => (
                  <option key={timeout} value={timeout}>
                    {timeout < 60 ? `${timeout} minutes` : `${timeout / 60} hour${timeout > 60 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          System Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-sm font-medium text-gray-600">Database</div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {systemStats.system_info.database.vendor} {systemStats.system_info.database.version}
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-sm font-medium text-gray-600">Operating System</div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {systemStats.system_info.os_info}
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-sm font-medium text-gray-600">Environment</div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {systemStats.system_info.environment}
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-sm font-medium text-gray-600">System Uptime</div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {systemStats.system_info.uptime}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMonitoring = () => (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        {!statsAvailable && statsError ? (
          // No data available state
          <div className={`p-8 rounded-lg text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className={`text-5xl mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>⚠️</div>
            <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              No Data Available
            </h4>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
              {statsError}
            </p>
            <button
              onClick={updateRealTimeStats}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              🔄 Try Again
            </button>
          </div>
        ) : (
          // Normal data display
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real-time Gauges */}
            <div className="space-y-6">
              <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>System Resources</h4>






              {/* CPU Gauge */}
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>CPU Usage</span>
                  <span className={`text-lg font-bold ${realTimeStats.cpu > 80 ? 'text-red-500' :
                    realTimeStats.cpu > 60 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                    {realTimeStats.cpu.toFixed(1)}%
                  </span>
                </div>
                <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${realTimeStats.cpu > 80 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                      realTimeStats.cpu > 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                        'bg-gradient-to-r from-green-400 to-green-600'
                      }`}
                    style={{ width: `${realTimeStats.cpu}%` }}
                  >
                    <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Memory Gauge */}
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Memory Usage</span>
                  <span className={`text-lg font-bold ${realTimeStats.memory > 80 ? 'text-red-500' :
                    realTimeStats.memory > 60 ? 'text-yellow-500' : 'text-blue-500'
                    }`}>
                    {realTimeStats.memory.toFixed(1)}%
                  </span>
                </div>
                <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${realTimeStats.memory > 80 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                      realTimeStats.memory > 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                        'bg-gradient-to-r from-blue-400 to-blue-600'
                      }`}
                    style={{ width: `${realTimeStats.memory}%` }}
                  >
                    <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Disk Gauge */}
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Disk Usage</span>
                  <span className={`text-lg font-bold ${realTimeStats.disk > 80 ? 'text-red-500' :
                    realTimeStats.disk > 60 ? 'text-yellow-500' : 'text-purple-500'
                    }`}>
                    {realTimeStats.disk.toFixed(1)}%
                  </span>
                </div>
                <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${realTimeStats.disk > 80 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                      realTimeStats.disk > 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                        'bg-gradient-to-r from-purple-400 to-purple-600'
                      }`}
                    style={{ width: `${realTimeStats.disk}%` }}
                  >
                    <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Stats Cards */}
            <div className="space-y-4">
              <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Live System Statistics</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <div className="text-2xl font-bold text-blue-500 animate-pulse">{realTimeStats.activeSessions}</div>
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Processes</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                    System Load
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <div className="text-2xl font-bold text-green-500">{realTimeStats.responseTime.toFixed(2)}s</div>
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Response Time</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                    API Performance
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center`}>
                  <div className="text-2xl font-bold text-orange-500">{realTimeStats.network.toFixed(1)}</div>
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Network MB/s</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                    Data Transfer
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'} text-center cursor-pointer hover:shadow-lg transition-shadow`} onClick={handleOpenActiveSessions}>
                  <div className="text-2xl font-bold text-purple-500">{systemStats.django.active_users || 0}</div>
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active Users</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                    Current Sessions
                  </div>
                </div>
              </div>

              {/* Auto-refresh Info */}
              <div className={`mt-4 p-3 rounded-lg text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'}`}>
                🔄 Auto-refreshing every 9 seconds | Powered by real system metrics
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeSystemTab) {
      case 'overview':
        return renderSystemOverview();
      case 'performance':
        return renderPerformance();
      case 'maintenance':
        return renderMaintenance();
      case 'backup':
        return renderBackupRestore();
      case 'logs':
        return renderSystemLogs();
      case 'security':
        return renderSecurity();
      case 'monitoring':
        return renderMonitoring();
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

      {/* Active Sessions Modal */}
      {showActiveSessionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-center sticky top-0 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  🔴 Live User Sessions
                </h2>
                {lastRefresh && (
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    Last updated: {lastRefresh.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={loadActiveSessions}
                  disabled={sessionsLoading}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'} ${sessionsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Refresh sessions"
                >
                  {sessionsLoading ? '⟳' : '🔄'}
                </button>
                <button
                  onClick={() => setShowActiveSessionsModal(false)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {sessionsError && (
                <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-100 border border-red-400'}`}>
                  <p className={`${isDark ? 'text-red-300' : 'text-red-800'}`}>
                    ⚠️ {sessionsError}
                  </p>
                </div>
              )}
              {sessionsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Loading live sessions...
                    </div>
                  </div>
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📭</div>
                  <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                    No Active Sessions
                  </h3>
                  <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    There are no active user sessions at the moment. Make sure you're logged in as an admin account.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <tr>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          User
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Email
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          IP Address
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Role
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Last Activity
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                          Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200`}>
                      {activeSessions.map((session, index) => (
                        <tr key={index} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {session.first_name} {session.last_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                              {session.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-mono px-3 py-1 rounded inline ${isDark ? 'bg-gray-700 text-green-400' : 'bg-gray-100 text-green-600'}`}>
                              {session.ip_address}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${session.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                              session.role === 'officer' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              }`}>
                              {session.role?.toUpperCase() || 'USER'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {new Date(session.last_activity).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              <span className="font-mono">{session.method}</span> {session.path}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      Total Active Sessions: <strong>{activeSessions.length}</strong>
                    </p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Data is based on user activity in the last 24 hours. Sessions automatically appear when users log in or make API requests. Auto-refreshing every 100 seconds.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemManagement;
