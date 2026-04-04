/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import apiService from '../services/api';

const MaintenanceContext = createContext();

const DEFAULT_MESSAGE = 'System is currently under maintenance. Please try again later.';

export const useMaintenanceMode = () => {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenanceMode must be used within a MaintenanceProvider');
  }
  return context;
};

export const MaintenanceProvider = ({ children }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(DEFAULT_MESSAGE);
  const [scheduledMaintenance, setScheduledMaintenance] = useState(null);
  const [maintenanceEndTime, setMaintenanceEndTime] = useState(null);
  const [loading, setLoading] = useState(true);

  const hydrateState = useCallback((payload) => {
    const nextMessage = payload?.message || DEFAULT_MESSAGE;
    const nextScheduledStart = payload?.scheduled_start ? new Date(payload.scheduled_start) : null;
    const now = new Date();

    setIsMaintenanceMode(Boolean(payload?.is_enabled));
    setMaintenanceMessage(nextMessage);
    setMaintenanceEndTime(payload?.scheduled_end || null);

    if (nextScheduledStart && nextScheduledStart > now) {
      setScheduledMaintenance({
        time: payload.scheduled_start,
        message: nextMessage,
      });
    } else {
      setScheduledMaintenance(null);
    }
  }, []);

  const refreshMaintenanceStatus = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const payload = await apiService.getMaintenanceStatus();
      hydrateState(payload);
    } catch {
      setIsMaintenanceMode(false);
      setMaintenanceMessage(DEFAULT_MESSAGE);
      setScheduledMaintenance(null);
      setMaintenanceEndTime(null);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [hydrateState]);

  useEffect(() => {
    refreshMaintenanceStatus();
    const interval = setInterval(() => {
      refreshMaintenanceStatus({ silent: true });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshMaintenanceStatus]);

  const enableMaintenanceMode = useCallback(async (message = null, duration = null) => {
    const startTime = new Date();
    const endTime = duration
      ? new Date(startTime.getTime() + duration * 60 * 1000).toISOString()
      : null;

    const payload = await apiService.updateMaintenanceStatus({
      is_enabled: true,
      message: message || DEFAULT_MESSAGE,
      scheduled_start: startTime.toISOString(),
      scheduled_end: endTime,
    });
    hydrateState(payload);
    return payload;
  }, [hydrateState]);

  const disableMaintenanceMode = useCallback(async () => {
    const payload = await apiService.updateMaintenanceStatus({
      is_enabled: false,
      message: maintenanceMessage || DEFAULT_MESSAGE,
      scheduled_start: null,
      scheduled_end: null,
    });
    hydrateState(payload);
    return payload;
  }, [hydrateState, maintenanceMessage]);

  const updateMaintenanceConfiguration = useCallback(async (updates) => {
    const payload = await apiService.updateMaintenanceStatus(updates);
    hydrateState(payload);
    return payload;
  }, [hydrateState]);

  const scheduleMaintenanceMode = useCallback(async (scheduledTime, message = null, duration = null) => {
    const startTime = new Date(scheduledTime);
    const endTime = duration
      ? new Date(startTime.getTime() + duration * 60 * 1000).toISOString()
      : null;

    const payload = await apiService.updateMaintenanceStatus({
      is_enabled: false,
      message: message || `Scheduled maintenance at ${startTime.toLocaleString()}`,
      scheduled_start: startTime.toISOString(),
      scheduled_end: endTime,
    });
    hydrateState(payload);
    return payload;
  }, [hydrateState]);

  const value = useMemo(
    () => ({
      isMaintenanceMode,
      maintenanceMessage,
      scheduledMaintenance,
      maintenanceEndTime,
      loading,
      refreshMaintenanceStatus,
      enableMaintenanceMode,
      disableMaintenanceMode,
      updateMaintenanceConfiguration,
      scheduleMaintenanceMode,
    }),
    [
      disableMaintenanceMode,
      enableMaintenanceMode,
      isMaintenanceMode,
      loading,
      maintenanceEndTime,
      maintenanceMessage,
      refreshMaintenanceStatus,
      scheduleMaintenanceMode,
      scheduledMaintenance,
      updateMaintenanceConfiguration,
    ],
  );

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
};
