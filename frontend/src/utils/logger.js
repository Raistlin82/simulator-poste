/**
 * Structured logging utility for frontend
 * Provides different log levels and integration points for monitoring services
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor() {
    // In production, only log INFO and above
    this.level = import.meta.env.PROD ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
  }

  /**
   * Debug logging - only in development
   */
  debug(message, context = {}) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.debug('[DEBUG]', message, context);
    }
  }

  /**
   * Info logging - general information
   */
  info(message, context = {}) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.info('[INFO]', message, context);
    }
  }

  /**
   * Warning logging - non-critical issues
   */
  warn(message, context = {}) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', message, context);
    }
  }

  /**
   * Error logging - critical issues
   */
  error(message, error, context = {}) {
    if (this.level <= LOG_LEVELS.ERROR) {
      const errorInfo = {
        message: error?.message,
        stack: error?.stack,
        ...context
      };

      console.error('[ERROR]', message, errorInfo);

      // In production, send to monitoring service
      if (import.meta.env.PROD) {
        // TODO: Integrate with Sentry, Datadog, or other monitoring service
        // Example:
        // Sentry.captureException(error, { contexts: { custom: context } });
      }
    }
  }

  /**
   * Performance logging - track timing
   */
  time(label) {
    console.time(`[PERF] ${label}`);
  }

  timeEnd(label) {
    console.timeEnd(`[PERF] ${label}`);
  }
}

// Export singleton instance
export const logger = new Logger();
