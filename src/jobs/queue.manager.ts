/**
 * Queue Manager using BullMQ
 * Handles async job processing for:
 * - Precompute jobs
 * - Cache invalidation
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { Redis } from 'ioredis';
import Logger from '../core/Logger';
import { precomputeService } from '../services/precompute.service';
import HotelBedFileRepo from '../Api/Components/hotelBed/hotelBed.repository';

interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  concurrency: number;
}

export interface PrecomputeJobData {
  type: 'full' | 'hotel';
  hotelCode?: string;
}

export interface CacheInvalidationJobData {
  pattern: string;
}

class QueueManager {
  private connection: Redis | null = null;
  private precomputeQueue: Queue | null = null;
  private cacheQueue: Queue | null = null;
  private workers: Worker[] = [];
  private queueEvents: QueueEvents[] = [];
  private config: QueueConfig;

  constructor() {
    this.config = {
      redis: {
        host: process.env.QUEUE_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.QUEUE_REDIS_PORT || process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
    };
  }

  /**
   * Initialize all queues and workers
   */
  async initialize(): Promise<void> {
    if (!process.env.ENABLE_QUEUE || process.env.ENABLE_QUEUE === 'false') {
      Logger.info('⏭️ Queue system disabled');
      return;
    }

    try {
      Logger.info('🔄 Initializing queue system...');

      // Create Redis connection for BullMQ
      this.connection = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        maxRetriesPerRequest: null, // Required for BullMQ
      });

      // Initialize queues
      this.precomputeQueue = new Queue('precompute', { connection: this.connection });
      this.cacheQueue = new Queue('cache', { connection: this.connection });

      // Initialize workers
      this.initializeWorkers();

      // Initialize queue events for monitoring
      this.initializeQueueEvents();

      Logger.info('✅ Queue system initialized');
    } catch (error) {
      Logger.error('❌ Failed to initialize queue system:', error);
      throw error;
    }
  }

  /**
   * Initialize workers for each queue
   */
  private initializeWorkers(): void {
    // Precompute worker
    const precomputeWorker = new Worker(
      'precompute',
      async (job: Job<PrecomputeJobData>) => {
        Logger.info(`Processing precompute job ${job.id}:`, job.data);

        if (job.data.type === 'full') {
          const result = await precomputeService.runFullPrecompute();
          await precomputeService.updateSearchIndex();
          return result;
        } else if (job.data.type === 'hotel' && job.data.hotelCode) {
          const result = await precomputeService.precomputeHotel(job.data.hotelCode);
          return result;
        }

        throw new Error('Invalid precompute job type');
      },
      {
        connection: this.connection!,
        concurrency: this.config.concurrency,
      }
    );

    precomputeWorker.on('completed', (job) => {
      Logger.info(`✅ Precompute job ${job.id} completed`);
    });

    precomputeWorker.on('failed', (job, err) => {
      Logger.error(`❌ Precompute job ${job?.id} failed:`, err);
    });

    // Cache invalidation worker
    const cacheWorker = new Worker(
      'cache',
      async (job: Job<CacheInvalidationJobData>) => {
        Logger.info(`Processing cache invalidation job ${job.id}:`, job.data);
        // Implementation depends on cache invalidation strategy
        return { invalidated: true };
      },
      {
        connection: this.connection!,
        concurrency: this.config.concurrency,
      }
    );

    this.workers = [precomputeWorker, cacheWorker];
  }

  /**
   * Initialize queue events for monitoring
   */
  private initializeQueueEvents(): void {
    const precomputeEvents = new QueueEvents('precompute', { connection: this.connection! });
    const cacheEvents = new QueueEvents('cache', { connection: this.connection! });

    this.queueEvents = [precomputeEvents, cacheEvents];
  }


  /**
   * Add precompute job to queue
   */
  async addPrecomputeJob(data: PrecomputeJobData): Promise<Job> {
    if (!this.precomputeQueue) {
      throw new Error('Queue system not initialized');
    }

    return await this.precomputeQueue.add('compute', data, {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 5,
      removeOnFail: 20,
    });
  }

  /**
   * Add cache invalidation job
   */
  async addCacheInvalidationJob(data: CacheInvalidationJobData): Promise<Job> {
    if (!this.cacheQueue) {
      throw new Error('Queue system not initialized');
    }

    return await this.cacheQueue.add('invalidate', data, {
      attempts: 1,
      removeOnComplete: true,
    });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    if (!this.precomputeQueue || !this.cacheQueue) {
      return null;
    }

    const [precomputeCounts, cacheCounts] = await Promise.all([
      this.precomputeQueue.getJobCounts(),
      this.cacheQueue.getJobCounts(),
    ]);

    return {
      precompute: precomputeCounts,
      cache: cacheCounts,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    Logger.info('🔄 Closing queue system...');

    // Close workers
    await Promise.all(this.workers.map((worker) => worker.close()));

    // Close queue events
    await Promise.all(this.queueEvents.map((events) => events.close()));

    // Close queues
    if (this.precomputeQueue) await this.precomputeQueue.close();
    if (this.cacheQueue) await this.cacheQueue.close();

    // Close Redis connection
    if (this.connection) await this.connection.quit();

    Logger.info('✅ Queue system closed');
  }
}

// Singleton instance
export const queueManager = new QueueManager();

