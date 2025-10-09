/**
 * Metrics Service using Prometheus
 * Per client requirements (Section 14 of checklist):
 * - Request latency histograms
 * - Cache hit ratio gauges
 * - Queue job counters
 * - Error rate counters
 */

import { register, Counter, Histogram, Gauge } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import Logger from '../core/Logger';

class MetricsService {
  private enabled: boolean;

  // Counters
  public readonly httpRequestsTotal: Counter;
  public readonly cacheHitsTotal: Counter;
  public readonly cacheMissesTotal: Counter;
  public readonly ingestRecordsTotal: Counter;
  public readonly precomputeJobsTotal: Counter;
  public readonly errorsTotal: Counter;

  // Histograms
  public readonly httpRequestDuration: Histogram;
  public readonly searchLatency: Histogram;
  public readonly matrixLatency: Histogram;
  public readonly dbQueryDuration: Histogram;

  // Gauges
  public readonly cacheHitRatio: Gauge;
  public readonly activeDatabaseConnections: Gauge;
  public readonly queueJobsPending: Gauge;

  constructor() {
    this.enabled = process.env.ENABLE_PROMETHEUS === 'true';

    if (!this.enabled) {
      Logger.info('⏭️ Prometheus metrics disabled');
    }

    // Initialize counters
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.cacheHitsTotal = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'], // search, matrix, static
    });

    this.cacheMissesTotal = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
    });

    this.ingestRecordsTotal = new Counter({
      name: 'ingest_records_total',
      help: 'Total number of records ingested',
      labelNames: ['section', 'mode'], // section: HOTEL, CCON, etc. mode: full, update
    });

    this.precomputeJobsTotal = new Counter({
      name: 'precompute_jobs_total',
      help: 'Total number of precompute jobs',
      labelNames: ['type', 'status'], // type: full, hotel. status: success, failure
    });

    this.errorsTotal = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'route'],
    });

    // Initialize histograms
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000], // milliseconds
    });

    this.searchLatency = new Histogram({
      name: 'search_latency_ms',
      help: 'Search endpoint latency in milliseconds',
      labelNames: ['cache_status'], // hit, miss
      buckets: [50, 100, 200, 500, 1000, 2000],
    });

    this.matrixLatency = new Histogram({
      name: 'matrix_latency_ms',
      help: 'Matrix endpoint latency in milliseconds',
      labelNames: ['cache_status'],
      buckets: [50, 100, 200, 500, 1000, 2000],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_ms',
      help: 'Database query duration in milliseconds',
      labelNames: ['operation'],
      buckets: [1, 5, 10, 50, 100, 500, 1000],
    });

    // Initialize gauges
    this.cacheHitRatio = new Gauge({
      name: 'cache_hit_ratio',
      help: 'Cache hit ratio (0-1)',
      labelNames: ['cache_type'],
    });

    this.activeDatabaseConnections = new Gauge({
      name: 'active_database_connections',
      help: 'Number of active database connections',
    });

    this.queueJobsPending = new Gauge({
      name: 'queue_jobs_pending',
      help: 'Number of pending queue jobs',
      labelNames: ['queue'], // ingest, precompute, cache
    });

    Logger.info('✅ Metrics service initialized');
  }

  /**
   * Middleware to track HTTP requests
   */
  trackHttpRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.enabled) return next();

      const startTime = Date.now();

      // Track response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const route = this.normalizeRoute(req.path);
        
        this.httpRequestsTotal.inc({
          method: req.method,
          route,
          status_code: res.statusCode,
        });

        this.httpRequestDuration.observe(
          {
            method: req.method,
            route,
            status_code: res.statusCode,
          },
          duration
        );
      });

      next();
    };
  }

  /**
   * Track cache hit/miss
   */
  trackCache(type: string, hit: boolean): void {
    if (!this.enabled) return;

    if (hit) {
      this.cacheHitsTotal.inc({ cache_type: type });
    } else {
      this.cacheMissesTotal.inc({ cache_type: type });
    }

    // Update hit ratio
    const hits = (this.cacheHitsTotal as any)
      .hashMap[`cache_type:${type}`]?.value || 0;
    const misses = (this.cacheMissesTotal as any)
      .hashMap[`cache_type:${type}`]?.value || 0;
    const total = hits + misses;
    
    if (total > 0) {
      this.cacheHitRatio.set({ cache_type: type }, hits / total);
    }
  }

  /**
   * Track ingest records
   */
  trackIngest(section: string, mode: string, count: number): void {
    if (!this.enabled) return;
    this.ingestRecordsTotal.inc({ section, mode }, count);
  }

  /**
   * Track precompute job
   */
  trackPrecompute(type: string, status: 'success' | 'failure'): void {
    if (!this.enabled) return;
    this.precomputeJobsTotal.inc({ type, status });
  }

  /**
   * Track error
   */
  trackError(type: string, route?: string): void {
    if (!this.enabled) return;
    this.errorsTotal.inc({ type, route: route || 'unknown' });
  }

  /**
   * Track search latency
   */
  trackSearchLatency(duration: number, cacheHit: boolean): void {
    if (!this.enabled) return;
    this.searchLatency.observe(
      { cache_status: cacheHit ? 'hit' : 'miss' },
      duration
    );
  }

  /**
   * Track matrix latency
   */
  trackMatrixLatency(duration: number, cacheHit: boolean): void {
    if (!this.enabled) return;
    this.matrixLatency.observe(
      { cache_status: cacheHit ? 'hit' : 'miss' },
      duration
    );
  }

  /**
   * Track database query
   */
  trackDbQuery(operation: string, duration: number): void {
    if (!this.enabled) return;
    this.dbQueryDuration.observe({ operation }, duration);
  }

  /**
   * Update queue stats
   */
  updateQueueStats(queue: string, pending: number): void {
    if (!this.enabled) return;
    this.queueJobsPending.set({ queue }, pending);
  }

  /**
   * Get metrics endpoint handler
   */
  getMetricsHandler() {
    return async (req: Request, res: Response) => {
      if (!this.enabled) {
        return res.status(404).send('Metrics disabled');
      }

      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        Logger.error('Error collecting metrics:', error);
        res.status(500).send('Error collecting metrics');
      }
    };
  }

  /**
   * Normalize route for metrics (remove IDs)
   */
  private normalizeRoute(path: string): string {
    return path
      .replace(/\/[0-9a-f-]{36}/g, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id'); // Numeric IDs
  }

  /**
   * Get current stats summary
   */
  async getStats(): Promise<any> {
    if (!this.enabled) return null;

    const metrics = await register.getMetricsAsJSON();
    
    return {
      requests: this.getMetricValue(metrics, 'http_requests_total'),
      cacheHitRatio: this.getMetricValue(metrics, 'cache_hit_ratio'),
      avgLatency: this.getHistogramStats(metrics, 'http_request_duration_ms'),
      errors: this.getMetricValue(metrics, 'errors_total'),
    };
  }

  private getMetricValue(metrics: any[], name: string): any {
    const metric = metrics.find(m => m.name === name);
    if (!metric || !metric.values) return null;
    
    return metric.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
  }

  private getHistogramStats(metrics: any[], name: string): any {
    const metric = metrics.find(m => m.name === name);
    if (!metric || !metric.values) return null;

    // Calculate p50, p95, p99 from histogram buckets
    // Simplified - in production use proper percentile calculation
    return {
      count: metric.values.filter((v: any) => v.metricName?.includes('_count')).length,
      sum: metric.values
        .filter((v: any) => v.metricName?.includes('_sum'))
        .reduce((s: number, v: any) => s + (v.value || 0), 0),
    };
  }
}

// Singleton instance
export const metricsService = new MetricsService();

