/**
 * Cron Job Management Controller
 * Provides API endpoints to trigger and monitor cron jobs manually
 */

import { Request, Response, NextFunction } from 'express';
import { scheduler } from '@/jobs';
import Logger from '@/core/Logger';

export class CronController {
  /**
   * Get status of all cron jobs
   * GET /api/v1/cron/status
   */
  async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = scheduler.getStatus();

      res.status(200).json({
        success: true,
        data: {
          jobs: status,
          total: status.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually trigger daily sync job
   * POST /api/v1/cron/trigger/daily-sync
   */
  async triggerDailySync(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      Logger.info('[CRON API] Manually triggering daily sync...');

      // Run in background
      scheduler.triggerJob('dailySync').catch(err => {
        Logger.error('[CRON API] Daily sync failed', err);
      });

      res.status(202).json({
        success: true,
        message: 'Daily sync job triggered',
        note: 'Job is running in background. Check logs for status.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually trigger weekly full sync job
   * POST /api/v1/cron/trigger/weekly-sync
   */
  async triggerWeeklySync(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      Logger.info('[CRON API] Manually triggering weekly full sync...');

      // Run in background
      scheduler.triggerJob('weeklyFullSync').catch(err => {
        Logger.error('[CRON API] Weekly sync failed', err);
      });

      res.status(202).json({
        success: true,
        message: 'Weekly full sync job triggered',
        note: 'Job is running in background. This may take several hours. Check logs for status.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually trigger price computation job
   * POST /api/v1/cron/trigger/price-computation
   */
  async triggerPriceComputation(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      Logger.info('[CRON API] Manually triggering price computation...');

      // Run in background
      scheduler.triggerJob('priceComputation').catch(err => {
        Logger.error('[CRON API] Price computation failed', err);
      });

      res.status(202).json({
        success: true,
        message: 'Price computation job triggered',
        note: 'Job is running in background. Check logs for status.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CronController();
