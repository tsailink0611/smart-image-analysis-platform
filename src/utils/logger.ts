/**
 * Production-ready logging utility
 * Replaces console.log with structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  component?: string
  operation?: string
  userId?: string
  metadata?: Record<string, unknown>
  errorInfo?: Record<string, unknown>
  errorType?: string
  inputLength?: number
  identifier?: string
  count?: number
  maxRequests?: number
  missingVars?: string[]
  [key: string]: unknown
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatMessage(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.isDevelopment && level === 'debug') {
      return // Skip debug logs in production
    }

    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`

    if (context) {
      const contextStr = JSON.stringify(context)
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`, contextStr)
    } else {
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`)
    }
  }

  debug(message: string, context?: LogContext): void {
    this.formatMessage('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.formatMessage('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.formatMessage('warn', message, context)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error ? {
      ...context,
      error: { message: error.message, stack: error.stack }
    } : context
    this.formatMessage('error', message, errorContext)
  }
}

export const logger = new Logger()

// For backward compatibility
export default logger