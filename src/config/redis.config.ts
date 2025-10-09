import { createClient, RedisClientType } from 'redis';
import Logger from '../core/Logger';
import { env } from './globals';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface CacheKeyConfig {
  version: string;
  ttl: {
    search: number;
    matrix: number;
    static: number;
    cheapest: number;
  };
}

class RedisManager {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  
  public readonly keyConfig: CacheKeyConfig = {
    version: process.env.REDIS_KEY_VERSION || 'v1',
    ttl: {
      search: parseInt(process.env.REDIS_TTL_SEARCH || '1800'),
      matrix: parseInt(process.env.REDIS_TTL_MATRIX || '900'),
      static: parseInt(process.env.REDIS_TTL_STATIC || '86400'),
      cheapest: parseInt(process.env.REDIS_TTL_CHEAPEST || '3600'),
    },
  };

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      const config: RedisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      };

      this.client = createClient({
        socket: {
          host: config.host,
          port: config.port,
        },
        password: config.password,
      });

      this.client.on('error', (err) => {
        Logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        Logger.info(`✅ Redis connected: ${config.host}:${config.port}`);
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        Logger.info('✅ Redis client ready');
      });

      this.client.on('end', () => {
        Logger.warn('⚠️ Redis connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      Logger.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      Logger.info('Redis connection closed');
    }
  }

  getClient(): RedisClientType | null {
    return this.client;
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Generate cache key for search results
   * Format: chp:v1:{dest|zone|geo}:{checkin}:{nights}:{occ}:{filtersHash}
   */
  generateSearchKey(params: {
    destination?: string;
    zone?: string;
    geo?: string;
    checkIn: string;
    nights: number;
    occupancy: number;
    filtersHash: string;
  }): string {
    const location = params.destination || params.zone || params.geo || 'all';
    return `chp:${this.keyConfig.version}:${location}:${params.checkIn}:${params.nights}:${params.occupancy}:${params.filtersHash}`;
  }

  /**
   * Generate cache key for hotel matrix detail
   * Format: mx:v1:{hotel_id}:{checkin}:{nights}:{occ}
   */
  generateMatrixKey(params: {
    hotelId: string;
    checkIn: string;
    nights: number;
    occupancy: number;
  }): string {
    return `mx:${this.keyConfig.version}:${params.hotelId}:${params.checkIn}:${params.nights}:${params.occupancy}`;
  }

  /**
   * Generate cache key for static hotel data
   * Format: st:v1:{hotel_id}
   */
  generateStaticKey(hotelId: string): string {
    return `st:${this.keyConfig.version}:${hotelId}`;
  }

  /**
   * Generate cache key for cheapest price per person
   * Format: chp:h:v1:{hotel_id}:{category_tag}
   */
  generateCheapestKey(hotelId: string, categoryTag: string): string {
    return `chp:h:${this.keyConfig.version}:${hotelId}:${categoryTag}`;
  }

  /**
   * Cache-aside get with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isReady()) {
      Logger.warn('Redis not ready, cache miss');
      return null;
    }

    try {
      const value = await this.client!.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      Logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Cache-aside set with automatic JSON stringification
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.isReady()) {
      Logger.warn('Redis not ready, skipping cache set');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client!.set(key, serialized);
      }
      return true;
    } catch (error) {
      Logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cache key(s)
   */
  async del(...keys: string[]): Promise<number> {
    if (!this.isReady()) {
      return 0;
    }

    try {
      return await this.client!.del(keys);
    } catch (error) {
      Logger.error(`Redis DEL error:`, error);
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern (use with caution in production)
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isReady()) {
      return 0;
    }

    try {
      const keys: string[] = [];
      for await (const key of this.client!.scanIterator({
        MATCH: pattern,
        COUNT: 100,
      })) {
        keys.push(key);
      }

      if (keys.length > 0) {
        return await this.client!.del(keys);
      }
      return 0;
    } catch (error) {
      Logger.error(`Redis pattern invalidation error:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    dbSize: number;
    memory: any;
  }> {
    if (!this.isReady()) {
      return { connected: false, dbSize: 0, memory: null };
    }

    try {
      const dbSize = await this.client!.dbSize();
      const info = await this.client!.info('memory');
      return {
        connected: true,
        dbSize,
        memory: info,
      };
    } catch (error) {
      Logger.error('Redis stats error:', error);
      return { connected: false, dbSize: 0, memory: null };
    }
  }
}

// Singleton instance
export const redisManager = new RedisManager();

// Export for backwards compatibility
export const redis_client = redisManager;

