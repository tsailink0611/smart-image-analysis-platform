import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { captureMessage } from '../lib/sentry';

interface PerformanceMetrics {
  loadTime?: number;
  apiCallDuration?: number;
  dataProcessingTime?: number;
  renderTime?: number;
}

export const usePerformanceMonitoring = () => {
  
  // ページロード時間の計測
  useEffect(() => {
    const measurePageLoad = () => {
      if ('performance' in window && 'getEntriesByType' in window.performance) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
          const domContentLoadedTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
          const firstContentfulPaint = performance.getEntriesByType('paint')
            .find(entry => entry.name === 'first-contentful-paint')?.startTime;

          // パフォーマンス指標をSentryに送信
          Sentry.withScope(scope => {
            scope.setTag('performance', 'page_load');
            scope.setContext('timing', {
              loadTime,
              domContentLoadedTime,
              firstContentfulPaint
            });
            
            // 問題のあるパフォーマンスをログ
            if (loadTime > 3000) { // 3秒以上
              captureMessage(`Slow page load detected: ${loadTime}ms`, 'warning');
            }
          });

          console.log('📊 Performance Metrics:', {
            loadTime,
            domContentLoadedTime,
            firstContentfulPaint
          });
        }
      }
    };

    // ページロード完了後に実行
    if (document.readyState === 'complete') {
      measurePageLoad();
    } else {
      window.addEventListener('load', measurePageLoad);
      return () => window.removeEventListener('load', measurePageLoad);
    }
  }, []);

  // API呼び出し時間の計測
  const measureApiCall = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      // Sentryにパフォーマンス情報を送信
      Sentry.addBreadcrumb({
        message: `API call: ${operationName}`,
        category: 'performance',
        data: {
          duration,
          success: true
        },
        level: 'info'
      });

      // 遅いAPI呼び出しを警告
      if (duration > 10000) { // 10秒以上
        captureMessage(`Slow API call: ${operationName} took ${duration}ms`, 'warning');
      }

      console.log(`🚀 API Performance - ${operationName}: ${duration}ms`);
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      Sentry.addBreadcrumb({
        message: `API call failed: ${operationName}`,
        category: 'performance',
        data: {
          duration,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        level: 'error'
      });

      throw error;
    }
  };

  // データ処理時間の計測
  const measureDataProcessing = <T>(
    operation: () => T,
    operationName: string,
    dataSize?: number
  ): T => {
    const startTime = performance.now();
    
    try {
      const result = operation();
      const duration = performance.now() - startTime;
      
      Sentry.addBreadcrumb({
        message: `Data processing: ${operationName}`,
        category: 'performance',
        data: {
          duration,
          dataSize,
          success: true
        },
        level: 'info'
      });

      // 大きなデータ処理での遅延を警告
      if (duration > 5000) { // 5秒以上
        captureMessage(`Slow data processing: ${operationName} took ${duration}ms for ${dataSize} items`, 'warning');
      }

      console.log(`📊 Data Processing - ${operationName}: ${duration}ms (${dataSize} items)`);
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      Sentry.addBreadcrumb({
        message: `Data processing failed: ${operationName}`,
        category: 'performance',
        data: {
          duration,
          dataSize,
          success: false
        },
        level: 'error'
      });

      throw error;
    }
  };

  // メモリ使用量の監視
  const checkMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const totalMB = memory.totalJSHeapSize / 1024 / 1024;
      const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;

      console.log(`🧠 Memory Usage: ${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB`);

      // メモリ使用量が多い場合は警告
      if (usedMB > limitMB * 0.8) { // 80%以上
        captureMessage(`High memory usage: ${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB`, 'warning');
      }

      return {
        used: usedMB,
        total: totalMB,
        limit: limitMB,
        percentage: (usedMB / limitMB) * 100
      };
    }
    return null;
  };

  return {
    measureApiCall,
    measureDataProcessing,
    checkMemoryUsage
  };
};

export default usePerformanceMonitoring;