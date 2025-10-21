import { Request, Response, NextFunction } from 'express';
import redisClient from '@config/redis';
import logger from '@utils/logger';

// Cache middleware
export const cacheMiddleware = (durationInSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    // Check if Redis is connected
    if (!redisClient.isReady()) {
      logger.warn('Cache: Redis not connected, skipping cache');
      next();
      return;
    }

    try {
      // Generate cache key from URL and query params
      const cacheKey = `cache:${req.originalUrl}`;

      // Try to get cached data
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        logger.info(`Cache: HIT for ${cacheKey}`);
        res.status(200).json(JSON.parse(cachedData));
        return;
      }

      logger.info(`Cache: MISS for ${cacheKey}`);

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (data: any) {
        // Cache the response
        redisClient.set(cacheKey, JSON.stringify(data), durationInSeconds)
          .then(() => {
            logger.info(`Cache: SET for ${cacheKey} (TTL: ${durationInSeconds}s)`);
          })
          .catch((error) => {
            logger.error(`Cache: Error setting cache for ${cacheKey}`, error);
          });

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache: Middleware error', error);
      next();
    }
  };
};

// Clear cache by pattern
export const clearCacheByPattern = async (pattern: string): Promise<void> => {
  try {
    if (!redisClient.isReady()) {
      logger.warn('Cache: Redis not connected, cannot clear cache');
      return;
    }

    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      for (const key of keys) {
        await redisClient.del(key);
      }
      logger.info(`Cache: Cleared ${keys.length} keys matching pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error(`Cache: Error clearing cache by pattern ${pattern}`, error);
  }
};

// Middleware to clear cache after mutations
export const clearCacheAfterMutation = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to clear cache after successful mutation
    res.json = function (data: any) {
      // Only clear cache for successful operations
      if (data.success) {
        patterns.forEach(pattern => {
          clearCacheByPattern(pattern).catch((error) => {
            logger.error('Cache: Error in clearCacheAfterMutation', error);
          });
        });
      }

      // Call original json method
      return originalJson(data);
    };

    next();
  };
};

export default { cacheMiddleware, clearCacheByPattern, clearCacheAfterMutation };

