/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

const MaintenanceContext = createContext();

export const useMaintenanceMode = () => {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenanceMode must be used within a MaintenanceProvider');
  }
  return context;
};

export const MaintenanceProvider = ({ children }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('System is currently under maintenance. Please try again later.');
  const [scheduledMaintenance, setScheduledMaintenance] = useState(null);
  const [maintenanceEndTime, setMaintenanceEndTime] = useState(null);

  // Check maintenance status from localStorage on load
  useEffect(() => {
    const savedMaintenanceMode = localStorage.getItem('maintenanceMode');
    const savedMessage = localStorage.getItem('maintenanceMessage');
    const savedScheduled = localStorage.getItem('scheduledMaintenance');
    const savedEndTime = localStorage.getItem('maintenanceEndTime');

    if (savedMaintenanceMode === 'true') {
      setIsMaintenanceMode(true);
    }
    if (savedMessage) {
      setMaintenanceMessage(savedMessage);
    }
    if (savedScheduled) {
      setScheduledMaintenance(JSON.parse(savedScheduled));
    }
    if (savedEndTime) {
      setMaintenanceEndTime(savedEndTime);
    }
  }, []);

  // Check if maintenance should auto-disable
  useEffect(() => {
    if (isMaintenanceMode && maintenanceEndTime) {
      const checkInterval = setInterval(() => {
        if (new Date() >= new Date(maintenanceEndTime)) {
          disableMaintenanceMode();
          clearInterval(checkInterval);
        }
      }, 1000);

      return () => clearInterval(checkInterval);
    }
  }, [isMaintenanceMode, maintenanceEndTime]);

  const enableMaintenanceMode = (message = null, duration = null) => {
    setIsMaintenanceMode(true);
    if (message) {
      setMaintenanceMessage(message);
      localStorage.setItem('maintenanceMessage', message);
    }

    if (duration) {
      const endTime = new Date(Date.now() + duration * 60 * 1000).toISOString();
      setMaintenanceEndTime(endTime);
      localStorage.setItem('maintenanceEndTime', endTime);
    }

    localStorage.setItem('maintenanceMode', 'true');
  };

  const disableMaintenanceMode = () => {
    setIsMaintenanceMode(false);
    setScheduledMaintenance(null);
    setMaintenanceEndTime(null);
    localStorage.setItem('maintenanceMode', 'false');
    localStorage.removeItem('scheduledMaintenance');
    localStorage.removeItem('maintenanceEndTime');
  };

  const scheduleMaintenanceMode = (scheduledTime, message = null) => {
    const scheduled = {
      time: scheduledTime,
      message: message || `Scheduled maintenance at ${new Date(scheduledTime).toLocaleString()}`
    };
    setScheduledMaintenance(scheduled);
    localStorage.setItem('scheduledMaintenance', JSON.stringify(scheduled));
  };

  const value = {
    isMaintenanceMode,
    maintenanceMessage,
    scheduledMaintenance,
    maintenanceEndTime,
    enableMaintenanceMode,
    disableMaintenanceMode,
    scheduleMaintenanceMode
  };

  return (
    <MaintenanceContext.Provider value={value}>
      {children}
    </MaintenanceContext.Provider>
  );
};
