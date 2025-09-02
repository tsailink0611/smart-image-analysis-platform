import * as Sentry from '@sentry/react';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const debug = import.meta.env.VITE_SENTRY_DEBUG === 'true';
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

  if (!dsn) {
    console.warn('⚠️ Sentry DSN not configured. Error monitoring disabled.');
    return;
  }

  // DSNの基本的な形式チェック
  if (!dsn.includes('ingest.sentry.io') || !dsn.startsWith('https://')) {
    console.error('❌ Invalid Sentry DSN format. Expected format: https://key@org.ingest.sentry.io/project');
    return;
  }

  console.log('🔧 Sentry初期化中...', {
    dsn: dsn.substring(0, 50) + '...',
    debug,
    appVersion,
    environment: import.meta.env.MODE
  });

  Sentry.init({
    dsn,
    debug,
    release: appVersion,
    environment: import.meta.env.MODE,
    
    // Performance monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    
    // Session replay (optional)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    
    // Enhanced error filtering
    beforeSend(event, hint) {
      // Filter out non-actionable errors
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          // Skip network errors that are user-related
          if (error.message.includes('NetworkError') || 
              error.message.includes('fetch')) {
            return null;
          }
        }
      }
      return event;
    },
  });

  console.log('✅ Sentry初期化完了 - エラー監視とパフォーマンス追跡が有効になりました');
  
  // 初期化成功のテストメッセージ
  Sentry.addBreadcrumb({
    message: 'Sentry SDK initialized successfully',
    category: 'init',
    level: 'info',
    data: {
      environment: import.meta.env.MODE,
      version: appVersion
    }
  });
};

// Helper functions for manual error reporting
export const captureError = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    Sentry.captureException(error);
  });
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};