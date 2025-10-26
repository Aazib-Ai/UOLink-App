interface PerformanceMetric {
    name: string
    value: number
    timestamp: number
    metadata?: Record<string, any>
}

interface NetworkInfo {
    effectiveType?: string
    downlink?: number
    rtt?: number
    saveData?: boolean
}

class MobilePerformanceMonitor {
    private static instance: MobilePerformanceMonitor
    private metrics: PerformanceMetric[] = []
    private observers: PerformanceObserver[] = []

    static getInstance(): MobilePerformanceMonitor {
        if (!MobilePerformanceMonitor.instance) {
            MobilePerformanceMonitor.instance = new MobilePerformanceMonitor()
        }
        return MobilePerformanceMonitor.instance
    }

    // Initialize performance monitoring
    init(): void {
        if (typeof window === 'undefined') return

        this.setupCoreWebVitalsMonitoring()
        this.setupResourceTimingMonitoring()
        this.setupNavigationTimingMonitoring()
    }

    // Monitor Core Web Vitals
    private setupCoreWebVitalsMonitoring(): void {
        // LCP (Largest Contentful Paint)
        if ('PerformanceObserver' in window) {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries()
                const lastEntry = entries[entries.length - 1] as any

                this.recordMetric({
                    name: 'LCP',
                    value: lastEntry.startTime,
                    timestamp: Date.now(),
                    metadata: {
                        element: lastEntry.element?.tagName,
                        url: lastEntry.url
                    }
                })
            })

            try {
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
                this.observers.push(lcpObserver)
            } catch (e) {
                console.warn('LCP monitoring not supported')
            }

            // FID (First Input Delay)
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries()
                entries.forEach((entry: any) => {
                    this.recordMetric({
                        name: 'FID',
                        value: entry.processingStart - entry.startTime,
                        timestamp: Date.now(),
                        metadata: {
                            eventType: entry.name
                        }
                    })
                })
            })

            try {
                fidObserver.observe({ entryTypes: ['first-input'] })
                this.observers.push(fidObserver)
            } catch (e) {
                console.warn('FID monitoring not supported')
            }

            // CLS (Cumulative Layout Shift)
            let clsValue = 0
            const clsObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries()
                entries.forEach((entry: any) => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value
                    }
                })

                this.recordMetric({
                    name: 'CLS',
                    value: clsValue,
                    timestamp: Date.now()
                })
            })

            try {
                clsObserver.observe({ entryTypes: ['layout-shift'] })
                this.observers.push(clsObserver)
            } catch (e) {
                console.warn('CLS monitoring not supported')
            }
        }
    }

    // Monitor resource loading (images, scripts, etc.)
    private setupResourceTimingMonitoring(): void {
        if ('PerformanceObserver' in window) {
            const resourceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries()
                entries.forEach((entry: any) => {
                    // Focus on images and critical resources
                    if (entry.initiatorType === 'img' || entry.initiatorType === 'fetch') {
                        this.recordMetric({
                            name: 'ResourceTiming',
                            value: entry.duration,
                            timestamp: Date.now(),
                            metadata: {
                                type: entry.initiatorType,
                                name: entry.name,
                                size: entry.transferSize,
                                cached: entry.transferSize === 0
                            }
                        })
                    }
                })
            })

            try {
                resourceObserver.observe({ entryTypes: ['resource'] })
                this.observers.push(resourceObserver)
            } catch (e) {
                console.warn('Resource timing monitoring not supported')
            }
        }
    }

    // Monitor navigation timing
    private setupNavigationTimingMonitoring(): void {
        if (typeof window !== 'undefined' && 'performance' in window) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const navigation = performance.getEntriesByType('navigation')[0] as any
                    if (navigation) {
                        this.recordMetric({
                            name: 'TTFB',
                            value: navigation.responseStart - navigation.requestStart,
                            timestamp: Date.now()
                        })

                        this.recordMetric({
                            name: 'DOMContentLoaded',
                            value: navigation.domContentLoadedEventEnd - navigation.navigationStart,
                            timestamp: Date.now()
                        })

                        this.recordMetric({
                            name: 'LoadComplete',
                            value: navigation.loadEventEnd - navigation.navigationStart,
                            timestamp: Date.now()
                        })
                    }
                }, 0)
            })
        }
    }

    // Record custom metrics
    recordMetric(metric: PerformanceMetric): void {
        this.metrics.push(metric)

        // Keep only last 100 metrics to prevent memory leaks
        if (this.metrics.length > 100) {
            this.metrics = this.metrics.slice(-100)
        }

        // Log performance issues
        this.checkPerformanceThresholds(metric)
    }

    // Check if metrics exceed performance thresholds
    private checkPerformanceThresholds(metric: PerformanceMetric): void {
        const thresholds = {
            LCP: 2500, // 2.5 seconds
            FID: 100,  // 100ms
            CLS: 0.1,  // 0.1
            TTFB: 800, // 800ms
            ResourceTiming: 3000 // 3 seconds for any resource
        }

        const threshold = thresholds[metric.name as keyof typeof thresholds]
        if (threshold && metric.value > threshold) {
            console.warn(`Performance threshold exceeded: ${metric.name} = ${metric.value}ms (threshold: ${threshold}ms)`, metric)

            // Could send to analytics service here
            this.reportPerformanceIssue(metric)
        }
    }

    // Report performance issues
    private reportPerformanceIssue(metric: PerformanceMetric): void {
        // This could integrate with analytics services
        const networkInfo = this.getNetworkInfo()

        const report = {
            metric,
            networkInfo,
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            url: window.location.href
        }

        // For now, just log to console
        console.log('Performance issue reported:', report)
    }

    // Get network information
    getNetworkInfo(): NetworkInfo {
        if (typeof navigator !== 'undefined' && 'connection' in navigator) {
            const connection = (navigator as any).connection
            return {
                effectiveType: connection?.effectiveType,
                downlink: connection?.downlink,
                rtt: connection?.rtt,
                saveData: connection?.saveData
            }
        }
        return {}
    }

    // Get performance summary
    getPerformanceSummary(): Record<string, any> {
        const summary: Record<string, any> = {}

        // Group metrics by name and calculate averages
        const groupedMetrics = this.metrics.reduce((acc, metric) => {
            if (!acc[metric.name]) {
                acc[metric.name] = []
            }
            acc[metric.name].push(metric.value)
            return acc
        }, {} as Record<string, number[]>)

        Object.entries(groupedMetrics).forEach(([name, values]) => {
            summary[name] = {
                average: values.reduce((sum, val) => sum + val, 0) / values.length,
                min: Math.min(...values),
                max: Math.max(...values),
                count: values.length,
                latest: values[values.length - 1]
            }
        })

        return {
            metrics: summary,
            networkInfo: this.getNetworkInfo(),
            timestamp: Date.now()
        }
    }

    // Measure custom operations
    measureOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
        const startTime = performance.now()

        return operation().then(
            (result) => {
                const duration = performance.now() - startTime
                this.recordMetric({
                    name: `Custom_${name}`,
                    value: duration,
                    timestamp: Date.now()
                })
                return result
            },
            (error) => {
                const duration = performance.now() - startTime
                this.recordMetric({
                    name: `Custom_${name}_Error`,
                    value: duration,
                    timestamp: Date.now(),
                    metadata: { error: error.message }
                })
                throw error
            }
        )
    }

    // Clean up observers
    destroy(): void {
        this.observers.forEach(observer => observer.disconnect())
        this.observers = []
        this.metrics = []
    }
}

export const performanceMonitor = MobilePerformanceMonitor.getInstance()