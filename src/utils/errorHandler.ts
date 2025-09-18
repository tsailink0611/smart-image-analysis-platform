/**
 * Centralized error handling utilities
 * Provides consistent error management across the application
 */

import { logger } from './logger'

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  UPLOAD = 'UPLOAD',
  ANALYSIS = 'ANALYSIS',
  PERMISSION = 'PERMISSION',
  UNKNOWN = 'UNKNOWN'
}

export interface AppError extends Error {
  type: ErrorType
  code: string | undefined
  statusCode: number | undefined
  context: Record<string, unknown> | undefined
}

export class SmartImageError extends Error implements AppError {
  public readonly type: ErrorType
  public readonly code: string | undefined
  public readonly statusCode: number | undefined
  public readonly context: Record<string, unknown> | undefined

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    code?: string,
    statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'SmartImageError'
    this.type = type
    this.code = code
    this.statusCode = statusCode
    this.context = context
  }
}

export const createError = {
  network: (message: string, statusCode?: number, context?: Record<string, unknown>) =>
    new SmartImageError(message, ErrorType.NETWORK, 'NETWORK_ERROR', statusCode, context),

  validation: (message: string, field?: string, context?: Record<string, unknown>) =>
    new SmartImageError(message, ErrorType.VALIDATION, 'VALIDATION_ERROR', 400, { field, ...context }),

  upload: (message: string, context?: Record<string, unknown>) =>
    new SmartImageError(message, ErrorType.UPLOAD, 'UPLOAD_ERROR', 400, context),

  analysis: (message: string, context?: Record<string, unknown>) =>
    new SmartImageError(message, ErrorType.ANALYSIS, 'ANALYSIS_ERROR', 500, context),

  permission: (message: string, context?: Record<string, unknown>) =>
    new SmartImageError(message, ErrorType.PERMISSION, 'PERMISSION_ERROR', 403, context)
}

export const handleError = (error: Error | AppError, component: string, operation: string): string => {
  const appError = error as AppError

  // Log the error with context
  logger.error(
    `Error in ${component}.${operation}`,
    error,
    {
      component,
      operation,
      errorType: appError.type || ErrorType.UNKNOWN,
      errorCode: appError.code,
      statusCode: appError.statusCode,
      context: appError.context
    }
  )

  // Return user-friendly message based on error type
  switch (appError.type) {
    case ErrorType.NETWORK:
      return 'ネットワークエラーが発生しました。インターネット接続を確認してください。'

    case ErrorType.VALIDATION:
      return `入力エラー: ${error.message}`

    case ErrorType.UPLOAD:
      return `ファイルアップロードエラー: ${error.message}`

    case ErrorType.ANALYSIS:
      return '画像分析中にエラーが発生しました。しばらく時間をおいて再度お試しください。'

    case ErrorType.PERMISSION:
      return 'この操作を実行する権限がありません。'

    default:
      return '予期しないエラーが発生しました。しばらく時間をおいて再度お試しください。'
  }
}

export const isNetworkError = (error: Error): boolean => {
  return error.message.includes('fetch') ||
         error.message.includes('network') ||
         error.message.includes('NETWORK_ERROR')
}

export const getUserFriendlyMessage = (error: Error): string => {
  if (isNetworkError(error)) {
    return 'インターネット接続を確認してください'
  }

  if (error.message.includes('401')) {
    return '認証が必要です'
  }

  if (error.message.includes('403')) {
    return 'アクセスが拒否されました'
  }

  if (error.message.includes('404')) {
    return 'リソースが見つかりません'
  }

  if (error.message.includes('500')) {
    return 'サーバーエラーが発生しました'
  }

  return error.message || '不明なエラーが発生しました'
}