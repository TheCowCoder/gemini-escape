/**
 * Centralized logging service
 * All logs are structured for Playwright capture and analysis
 */

export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  context: string;
  message: string;
  data?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

// In-memory log buffer (for Playwright access via window.__logs)
const logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 500;

// Browser environment detection
const isBrowser = typeof window !== 'undefined';

export const logger = {
  debug: (context: string, message: string, data?: Record<string, any>) => {
    const entry: LogEntry = { timestamp: Date.now(), level: 'debug', context, message, data };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER_SIZE) logBuffer.shift();
    if (isBrowser) {
      console.log(`[${context}] ${message}`, data);
    }
  },

  info: (context: string, message: string, data?: Record<string, any>) => {
    const entry: LogEntry = { timestamp: Date.now(), level: 'info', context, message, data };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER_SIZE) logBuffer.shift();
    if (isBrowser) {
      console.log(`[${context}] ${message}`, data);
    }
  },

  warn: (context: string, message: string, data?: Record<string, any>) => {
    const entry: LogEntry = { timestamp: Date.now(), level: 'warn', context, message, data };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER_SIZE) logBuffer.shift();
    console.warn(`[${context}] ${message}`, data);
  },

  error: (context: string, message: string, error?: Error | any, data?: Record<string, any>) => {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'error',
      context,
      message,
      data,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER_SIZE) logBuffer.shift();
    console.error(`[${context}] ${message}`, error, data);
  },

  fatal: (context: string, message: string, error?: Error | any) => {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'fatal',
      context,
      message,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER_SIZE) logBuffer.shift();
    console.error(`[FATAL] [${context}] ${message}`, error);
  },

  // Get all logs (for Playwright access)
  getAllLogs: () => [...logBuffer],

  // Get logs filtered by context
  getLogsByContext: (context: string) => logBuffer.filter(log => log.context === context),

  // Get logs filtered by level
  getLogsByLevel: (level: string) => logBuffer.filter(log => log.level === level),

  // Get recent logs
  getRecentLogs: (count: number = 50) => logBuffer.slice(-count),

  // Clear logs
  clearLogs: () => {
    logBuffer.length = 0;
  }
};

// Expose to window for Playwright access
if (isBrowser && typeof window !== 'undefined') {
  (window as any).__logs = {
    getAll: () => logger.getAllLogs(),
    getByContext: (context: string) => logger.getLogsByContext(context),
    getByLevel: (level: string) => logger.getLogsByLevel(level),
    getRecent: (count?: number) => logger.getRecentLogs(count),
    clear: () => logger.clearLogs(),
    buffer: logBuffer
  };
}
