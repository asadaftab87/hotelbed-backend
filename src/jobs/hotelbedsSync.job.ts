/**
 * Hotelbeds Data Sync Cron Job
 * Automatically downloads and imports updates from Hotelbeds API
 * 
 * Schedule Options:
 * - Daily at 2 AM: '0 2 * * *'
 * - Every 6 hours: '0 *6 * * *''
 * - Every hour: 0 * * * *
 */

import { HotelBedFileService } from '@/api/components/hotelBed/hotelBed.service';
import Logger from '@/core/Logger';

export class HotelbedsSync {
  private service: HotelBedFileService;
  private isRunning: boolean = false;

  constructor() {
    this.service = new HotelBedFileService();
  }

  /**
   * Main sync method - downloads and imports updates
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('[CRON] Sync already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      Logger.info('[CRON] 🚀 Starting Hotelbeds data sync...');
      Logger.info('[CRON] Timestamp:', new Date().toISOString());

      // Download and import update data (incremental)
      const result = await this.service.downloadUpdate();

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

      Logger.info('[CRON] ✅ Sync completed successfully', {
        duration: `${duration} minutes`,
        tablesLoaded: result.import?.tables ? Object.keys(result.import.tables).length : 0,
        totalRecords: result.import?.totalRecords || 0,
      });

      // Compute cheapest prices after import
      Logger.info('[CRON] 💰 Computing cheapest prices...');
      await this.service.computeCheapestPrices('ALL');
      Logger.info('[CRON] ✅ Cheapest prices computed');

    } catch (error: any) {
      Logger.error('[CRON] ❌ Sync failed', {
        error: error.message,
        stack: error.stack,
        duration: `${((Date.now() - startTime) / 1000 / 60).toFixed(2)} minutes`,
      });

      // TODO: Send alert notification (email/Slack/SMS)
      // await this.sendAlert(error);

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Full cache sync - downloads complete dataset (use sparingly!)
   * Only run this weekly or when data is completely corrupted
   */
  async runFullSync(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('[CRON] Full sync already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      Logger.info('[CRON] 🚀 Starting FULL Hotelbeds cache sync...');
      Logger.info('[CRON] ⚠️  This will clean all existing data!');

      // Download complete cache (cleans database first)
      const result = await this.service.downloadCache();

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

      Logger.info('[CRON] ✅ Full sync completed', {
        duration: `${duration} minutes`,
        totalRecords: result.import?.totalRecords || 0,
      });

      // Compute cheapest prices
      Logger.info('[CRON] 💰 Computing cheapest prices...');
      await this.service.computeCheapestPrices('ALL');
      Logger.info('[CRON] ✅ Cheapest prices computed');

    } catch (error: any) {
      Logger.error('[CRON] ❌ Full sync failed', {
        error: error.message,
        stack: error.stack,
      });

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Health check - verifies data is fresh
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if we have recent data
      // TODO: Query database for latest import timestamp
      // If older than 48 hours, trigger sync
      return true;
    } catch (error) {
      Logger.error('[CRON] Health check failed', { error });
      return false;
    }
  }
}
