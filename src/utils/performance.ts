/**
 * Performance monitoring utilities
 */

interface PerformanceMetrics {
  name: string
  startTime: number
  endTime?: number
  duration?: number
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map()

  start(name: string): void {
    this.metrics.set(name, {
      name,
      startTime: performance.now()
    })
  }

  end(name: string): number | null {
    const metric = this.metrics.get(name)
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`)
      return null
    }

    const endTime = performance.now()
    const duration = endTime - metric.startTime

    this.metrics.set(name, {
      ...metric,
      endTime,
      duration
    })

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`)
    }

    return duration
  }

  getMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values()).filter(m => m.duration !== undefined)
  }

  clear(): void {
    this.metrics.clear()
  }
}

export const performanceMonitor = new PerformanceMonitor()

// Bundle analyzer helper
export const logBundleInfo = (): void => {
  if (process.env.NODE_ENV === 'development') {
    const scripts = document.querySelectorAll('script[src]')
    const styles = document.querySelectorAll('link[rel="stylesheet"]')

    console.group('📦 Bundle Analysis')
    console.log(`Scripts loaded: ${scripts.length}`)
    console.log(`Stylesheets loaded: ${styles.length}`)

    if ('connection' in navigator) {
      const conn = (navigator as { connection?: { effectiveType: string; downlink: number } }).connection
      if (conn) {
        console.log(`Network: ${conn.effectiveType}`)
        console.log(`Downlink: ${conn.downlink}Mbps`)
      }
    }
    console.groupEnd()
  }
}