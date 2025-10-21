import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';
import logger from '@utils/logger';

dotenv.config();

class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD || undefined,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis: Max reconnection attempts reached');
              return new Error('Redis: Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.setupEventHandlers();
    } catch (error) {
      logger.error('Redis: Failed to initialize client', error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis: Connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('✅ Redis: Connected successfully!');
    });

    this.client.on('error', (error) => {
      logger.error('Redis: Connection error', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.warn('Redis: Connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis: Reconnecting...');
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.client) {
        this.initializeClient();
      }

      if (!this.isConnected && this.client) {
        await this.client.connect();
      }
    } catch (error) {
      logger.error('Redis: Connection failed', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis: Disconnected successfully');
      }
    } catch (error) {
      logger.error('Redis: Disconnect error', error);
    }
  }

  getClient(): RedisClientType | null {
    return this.client;
  }

  isReady(): boolean {
    return this.isConnected;
  }

  // Cache Operations
  async get(key: string): Promise<string | null> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis: Client not connected');
        return null;
      }
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Redis: Error getting key ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: string, expiryInSeconds?: number): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis: Client not connected');
        return false;
      }

      if (expiryInSeconds) {
        await this.client.setEx(key, expiryInSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error(`Redis: Error setting key ${key}`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis: Client not connected');
        return false;
      }
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis: Error deleting key ${key}`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis: Client not connected');
        return false;
      }
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis: Error checking key ${key}`, error);
      return false;
    }
  }

  async flushAll(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis: Client not connected');
        return false;
      }
      await this.client.flushAll();
      logger.info('Redis: All keys flushed');
      return true;
    } catch (error) {
      logger.error('Redis: Error flushing all keys', error);
      return false;
    }
  }

  async setJSON(key: string, value: any, expiryInSeconds?: number): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value);
      return await this.set(key, jsonString, expiryInSeconds);
    } catch (error) {
      logger.error(`Redis: Error setting JSON for key ${key}`, error);
      return false;
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const data = await this.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`Redis: Error getting JSON for key ${key}`, error);
      return null;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis: Client not connected');
        return [];
      }
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis: Error getting keys with pattern ${pattern}`, error);
      return [];
    }
  }
}

// Export singleton instance
const redisClient = new RedisClient();
export default redisClient;

