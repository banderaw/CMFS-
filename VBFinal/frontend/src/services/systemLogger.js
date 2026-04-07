class SystemLogger {
  constructor() {
    this.logs = this.loadLogs();
    this.maxLogs = 100;
  }

  loadLogs() {
    try {
      const saved = localStorage.getItem('systemLogs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveLogs() {
    try {
      localStorage.setItem('systemLogs', JSON.stringify(this.logs.slice(-this.maxLogs)));
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  }

  log(level, message, category = 'SYSTEM') {
    const logEntry = {
      id: Date.now() + Math.random(),
      level: level.toUpperCase(),
      message,
      category,
      timestamp: new Date().toISOString(),
      user: this.getCurrentUser()
    };

    this.logs.unshift(logEntry);
    this.saveLogs();
  }

  getCurrentUser() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.email || 'system';
    } catch {
      return 'system';
    }
  }

  info(message, category) {
    this.log('INFO', message, category);
  }

  warn(message, category) {
    this.log('WARN', message, category);
  }

  error(message, category) {
    this.log('ERROR', message, category);
  }

  success(message, category) {
    this.log('SUCCESS', message, category);
  }

  getLogs(limit = 50) {
    return this.logs.slice(0, limit);
  }

  clearLogs() {
    this.logs = [];
    this.saveLogs();
  }

  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level.toUpperCase());
  }

  getLogsByCategory(category) {
    return this.logs.filter(log => log.category === category);
  }
}

const systemLogger = new SystemLogger();
systemLogger.info('System initialized', 'STARTUP');

export default systemLogger;
