import * as Sentry from '@sentry/react';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const debug = import.meta.env.VITE_SENTRY_DEBUG === 'true';
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

  console.log('🐛 DEBUG: 環境変数確認', {
    dsnExists: !!dsn,
    dsnLength: dsn?.length,
    dsnStart: dsn?.substring(0, 30),
    hasAtSymbol: dsn?.includes('@'),
    allEnvKeys: Object.keys(import.meta.env).filter(key => key.includes('SENTRY'))
  });

  if (!dsn) {
    console.warn('⚠️ Sentry DSN not configured. Error monitoring disabled.');
    return;
  }

  // DSNの基本的な形式チェック - より柔軟に  
  if (!dsn.includes('sentry.io') || !dsn.startsWith('https://') || !dsn.includes('@')) {
    console.error('❌ Invalid Sentry DSN format. Expected format: https://key@org.ingest.sentry.io/project');
    console.error('❌ Received DSN:', dsn);
    return;
  }

  console.log('🔧 Sentry初期化中...', {
    dsn: dsn.substring(0, 50) + '...',
    dsnLength: dsn.length,
    debug,
    appVersion,
    environment: import.meta.env.MODE,
    isDsnValid: dsn.includes('@') && dsn.includes('sentry.io')
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

  // 初期化直後にテストメッセージを送信
  setTimeout(() => {
    captureMessage('🚀 SAP Frontend - アプリケーション起動', 'info');
    console.log('🎯 Sentry初期化テストメッセージを送信しました');
  }, 1000);
};

// Helper functions for manual error reporting
export const captureError = (error: Error, context?: Record<string, any>) => {
  console.log('🔴 Sentry - エラーを送信中:', error.message);
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
      console.log('🔴 Sentry - コンテキスト:', context);
    }
    
    try {
      Sentry.captureException(error);
      console.log('✅ Sentry - エラー送信完了');
    } catch (e) {
      console.error('❌ Sentry - エラー送信失敗:', e);
    }
  });
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  console.log(`📝 Sentry - メッセージを送信中 [${level}]:`, message);
  try {
    Sentry.captureMessage(message, level);
    console.log('✅ Sentry - メッセージ送信完了');
  } catch (e) {
    console.error('❌ Sentry - メッセージ送信失敗:', e);
  }
};