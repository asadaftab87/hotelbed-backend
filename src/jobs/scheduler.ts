/**
 * Cron Job Scheduler
 * Manages all scheduled tasks for the hotelbed backend
 * 
 * Jobs:
 * 1. HotelbedsSync - Daily data sync (incremental)
 * 2. HotelbedsSync - Weekly full cache refresh
 * 3. CheapestPrice - Every 6 hours price recalculation
 */

import cron, { ScheduledTask } from 'node-cron';
import { HotelbedsSync } from './hotelbedsSync.job';
import { CheapestPriceJob } from './cheapestPrice.job';
import Logger from '@/core/Logger';

export class CronScheduler {
  private syncJob: HotelbedsSync;
  private priceJob: CheapestPriceJob;
  private tasks: Map<string, ScheduledTask> = new Map();

  constructor() {
    this.syncJob = new HotelbedsSync();
    this.priceJob = new CheapestPriceJob();
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    Logger.info('[SCHEDULER] 🚀 Starting cron scheduler...');

    // 1. Daily incremental sync at 2:00 AM
    const dailySync = cron.schedule('0 2 * * *', async () => {
      Logger.info('[SCHEDULER] ⏰ Triggering daily incremental sync...');
      await this.syncJob.run();
    }, {
      timezone: 'UTC',
    });
    this.tasks.set('dailySync', dailySync);

    // 2. Weekly full cache refresh on Sunday at 3:00 AM
    const weeklyFullSync = cron.schedule('0 3 * * 0', async () => {
      Logger.info('[SCHEDULER] ⏰ Triggering weekly full cache refresh...');
      await this.syncJob.runFullSync();
    }, {
      timezone: 'UTC',
    });
    this.tasks.set('weeklyFullSync', weeklyFullSync);

    // 3. Cheapest price computation every 6 hours
    const priceComputation = cron.schedule('0 */6 * * *', async () => {
      Logger.info('[SCHEDULER] ⏰ Triggering cheapest price computation...');
      await this.priceJob.run();
    }, {
      timezone: 'UTC',
    });
    this.tasks.set('priceComputation', priceComputation);

    Logger.info('[SCHEDULER] ✅ All cron jobs started', {
      jobs: Array.from(this.tasks.keys()),
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    Logger.info('[SCHEDULER] 🛑 Stopping all cron jobs...');

    this.tasks.forEach((task, name) => {
      task.stop();
      Logger.info(`[SCHEDULER] Stopped: ${name}`);
    });

    this.tasks.clear();
    Logger.info('[SCHEDULER] ✅ All cron jobs stopped');
  }

  /**
   * Get status of all jobs
   */
  getStatus(): { name: string; running: boolean }[] {
    return Array.from(this.tasks.entries()).map(([name, task]) => ({
      name,
      running: task ? true : false,
    }));
  }

  /**
   * Manually trigger a specific job (for testing)
   */
  async triggerJob(jobName: 'dailySync' | 'weeklyFullSync' | 'priceComputation'): Promise<void> {
    Logger.info(`[SCHEDULER] 🔧 Manually triggering: ${jobName}`);

    try {
      switch (jobName) {
        case 'dailySync':
          await this.syncJob.run();
          break;

        case 'weeklyFullSync':
          await this.syncJob.runFullSync();
          break;

        case 'priceComputation':
          await this.priceJob.run();
          break;

        default:
          throw new Error(`Unknown job: ${jobName}`);
      }

      Logger.info(`[SCHEDULER] ✅ Job completed: ${jobName}`);

    } catch (error: any) {
      Logger.error(`[SCHEDULER] ❌ Job failed: ${jobName}`, {
        error: error.message,
      });
      throw error;
    }
  }
}

// Singleton instance
export const scheduler = new CronScheduler();
