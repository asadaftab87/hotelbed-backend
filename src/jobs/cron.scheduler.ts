/**
 * Cron Scheduler
 * Schedules recurring jobs per client requirements:
 * - Precompute (hourly or configurable)
 * - Cleanup (daily)
 */

import * as cron from 'node-cron';
import Logger from '../core/Logger';
import { queueManager } from './queue.manager';
import { precomputeService } from '../services/precompute.service';
import { randomUUID } from 'crypto';

class CronScheduler {
  private jobs: cron.ScheduledTask[] = [];

  /**
   * Initialize all cron jobs
   */
  initialize(): void {
    Logger.info('🔄 Initializing cron scheduler...');

    // Precompute job
    const precomputeInterval = parseInt(process.env.PRECOMPUTE_INTERVAL_MIN || '60');
    this.schedulePrecomputeJob(precomputeInterval);

    // Cleanup job (daily at 2 AM)
    this.scheduleCleanupJob();

    Logger.info(`✅ Cron scheduler initialized with ${this.jobs.length} jobs`);
  }

  /**
   * Schedule precompute job
   */
  private schedulePrecomputeJob(intervalMinutes: number): void {
    const cronExpression = this.minutesToCron(intervalMinutes);

    const job = cron.schedule(cronExpression, async () => {
      Logger.info('⏰ Running scheduled precompute job...');

      try {
        await queueManager.addPrecomputeJob({
          type: 'full',
        });

        Logger.info('✅ Precompute job queued');
      } catch (error) {
        Logger.error('❌ Failed to queue precompute job:', error);
      }
    });

    this.jobs.push(job);
    Logger.info(`📅 Precompute job scheduled: every ${intervalMinutes} minutes`);
  }

  /**
   * Schedule cleanup job (runs daily at 2 AM)
   */
  private scheduleCleanupJob(): void {
    const job = cron.schedule('0 2 * * *', async () => {
      Logger.info('⏰ Running scheduled cleanup job...');

      try {
        // Cleanup expired cheapest prices
        const deleted = await precomputeService.cleanupExpired();
        Logger.info(`✅ Cleanup completed: ${deleted} records deleted`);

      } catch (error) {
        Logger.error('❌ Cleanup job failed:', error);
      }
    });

    this.jobs.push(job);
    Logger.info('📅 Cleanup job scheduled: daily at 2:00 AM');
  }

  /**
   * Convert minutes to cron expression
   */
  private minutesToCron(minutes: number): string {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return `0 */${hours} * * *`; // Every N hours
    } else {
      return `*/${minutes} * * * *`; // Every N minutes
    }
  }

  /**
   * Stop all cron jobs
   */
  stopAll(): void {
    Logger.info('🛑 Stopping all cron jobs...');
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    Logger.info('✅ All cron jobs stopped');
  }

  /**
   * Get status of all jobs
   */
  getStatus(): Array<{ running: boolean }> {
    return this.jobs.map(job => ({
      running: job.getStatus() === 'scheduled',
    }));
  }
}

// Singleton instance
export const cronScheduler = new CronScheduler();

