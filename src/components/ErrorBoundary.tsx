import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Send error to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('component', 'ErrorBoundary');
      scope.setContext('errorInfo', {
        componentStack: errorInfo.componentStack
      });
      Sentry.captureException(error);
    });

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          backgroundColor: '#fff5f5', 
          border: '1px solid #fed7d7',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#c53030', marginBottom: '16px' }}>
            🚨 アプリケーションエラーが発生しました
          </h2>
          <p style={{ color: '#742a2a', marginBottom: '16px' }}>
            申し訳ございませんが、予期しないエラーが発生しました。
          </p>
          <details style={{ textAlign: 'left', marginBottom: '16px' }}>
            <summary style={{ cursor: 'pointer', color: '#744210' }}>
              エラー詳細（開発者向け）
            </summary>
            <pre style={{ 
              backgroundColor: '#fffbeb', 
              padding: '12px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {this.state.error?.message}
              {this.state.error?.stack}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#3182ce',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ページを再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Sentry-enhanced ErrorBoundary component
export const SentryErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: ReactNode }) => <>{children}</>,
  {
    fallback: ({ error, resetError }) => (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        backgroundColor: '#fff5f5', 
        border: '1px solid #fed7d7',
        borderRadius: '8px',
        margin: '20px'
      }}>
        <h2 style={{ color: '#c53030', marginBottom: '16px' }}>
          🔍 エラーが検出されました
        </h2>
        <p style={{ color: '#742a2a', marginBottom: '16px' }}>
          エラーは自動的に報告されました。開発チームが確認いたします。
        </p>
        <button 
          onClick={resetError}
          style={{
            backgroundColor: '#3182ce',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          再試行
        </button>
        <button 
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#718096',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ページ再読み込み
        </button>
      </div>
    ),
  }
);

export default ErrorBoundary;