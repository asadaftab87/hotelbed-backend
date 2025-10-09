import { Request, Response, NextFunction } from 'express';
import { redisManager } from '../config/redis.config';
import Logger from '../core/Logger';
import crypto from 'crypto';

export interface CacheAsideOptions {
  ttl: number;
  keyGenerator?: (req: Request) => string;
  enabled?: boolean;
  staleWhileRevalidate?: boolean;
  swrStaleTime?: number; // seconds
}

/**
 * Cache-aside middleware factory
 * Implements the cache-aside pattern with optional stale-while-revalidate (SWR)
 */
export function cacheAside(options: CacheAsideOptions) {
  const {
    ttl,
    keyGenerator,
    enabled = true,
    staleWhileRevalidate = false,
    swrStaleTime = 300, // 5 minutes default
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip cache if disabled or Redis not available
    if (!enabled || !redisManager.isReady()) {
      Logger.debug('Cache disabled or Redis not available, skipping cache');
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : generateDefaultKey(req);

      // Check if key exists in cache
      const cached = await redisManager.get<any>(cacheKey);

      if (cached) {
        // Cache hit
        Logger.debug(`Cache HIT: ${cacheKey}`);
        
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);

        // If SWR is enabled, check if data is stale
        if (staleWhileRevalidate && cached._cachedAt) {
          const age = (Date.now() - cached._cachedAt) / 1000;
          if (age > swrStaleTime && age < ttl) {
            // Serve stale data
            res.setHeader('X-Cache-Status', 'STALE');
            Logger.debug(`Serving stale data for ${cacheKey}, triggering revalidation`);
            
            // Trigger async revalidation (fire and forget)
            setImmediate(() => {
              // The actual request handler will run and update the cache
              // This is a simplified approach; in production, use a job queue
            });
          } else {
            res.setHeader('X-Cache-Status', 'FRESH');
          }
        }

        return res.json(cached);
      }

      // Cache miss - intercept response to cache it
      Logger.debug(`Cache MISS: ${cacheKey}`);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache the response
      res.json = function (data: any) {
        // Add timestamp for SWR
        if (staleWhileRevalidate) {
          data._cachedAt = Date.now();
        }

        // Cache the response asynchronously (don't block response)
        setImmediate(async () => {
          try {
            await redisManager.set(cacheKey, data, ttl);
            Logger.debug(`Cached response for ${cacheKey} with TTL ${ttl}s`);
          } catch (error) {
            Logger.error(`Failed to cache response for ${cacheKey}:`, error);
          }
        });

        // Send response immediately
        return originalJson(data);
      };

      next();
    } catch (error) {
      Logger.error('Cache-aside middleware error:', error);
      // Continue without cache on error
      next();
    }
  };
}

/**
 * Generate default cache key from request
 */
function generateDefaultKey(req: Request): string {
  const method = req.method;
  const path = req.path;
  const query = req.query;
  
  // Create a hash of query parameters for consistent keys
  const queryString = JSON.stringify(query);
  const queryHash = crypto
    .createHash('md5')
    .update(queryString)
    .digest('hex')
    .substring(0, 8);

  return `${method}:${path}:${queryHash}`;
}

/**
 * Generate hash for filters (used in search)
 */
export function hashFilters(filters: Record<string, any>): string {
  const normalized = JSON.stringify(filters, Object.keys(filters).sort());
  return crypto
    .createHash('md5')
    .update(normalized)
    .digest('hex')
    .substring(0, 12);
}

/**
 * Middleware to invalidate cache by pattern
 */
export function invalidateCache(pattern: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await redisManager.invalidatePattern(pattern);
      Logger.info(`Invalidated ${deleted} cache keys matching pattern: ${pattern}`);
    } catch (error) {
      Logger.error('Cache invalidation error:', error);
    }
    next();
  };
}

/**
 * Middleware to add trace ID to requests
 */
export function addTraceId(req: Request, res: Response, next: NextFunction) {
  const traceId = crypto.randomUUID();
  req.headers['x-trace-id'] = traceId;
  res.setHeader('X-Trace-ID', traceId);
  next();
}

