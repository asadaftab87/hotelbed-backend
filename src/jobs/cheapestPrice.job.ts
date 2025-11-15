/**
 * Cheapest Price Computation Cron Job
 * Recalculates cheapest prices for all hotels periodically
 * 
 * Schedule: Every 6 hours or after data updates
 */

import { HotelBedFileService } from '@/api/components/hotelBed/hotelBed.service';
import Logger from '@/core/Logger';

export class CheapestPriceJob {
  private service: HotelBedFileService;
  private isRunning: boolean = false;

  constructor() {
    this.service = new HotelBedFileService();
  }

  /**
   * Compute cheapest prices for all hotels
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('[CRON] Price computation already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      Logger.info('[CRON] 💰 Starting cheapest price computation...');

      // Compute for both CITY_TRIP and OTHER categories
      const result = await this.service.computeCheapestPrices('ALL');

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      Logger.info('[CRON] ✅ Price computation completed', {
        duration: `${duration}s`,
        processed: result.processed || 0,
        computed: result.computed || 0,
      });

    } catch (error: any) {
      Logger.error('[CRON] ❌ Price computation failed', {
        error: error.message,
        stack: error.stack,
      });

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Compute for specific hotel (useful for testing)
   */
  async runForHotel(hotelId: number): Promise<void> {
    try {
      Logger.info(`[CRON] 💰 Computing prices for hotel ${hotelId}...`);

      await this.service.computeCheapestPrices('ALL', hotelId);

      Logger.info(`[CRON] ✅ Prices computed for hotel ${hotelId}`);

    } catch (error: any) {
      Logger.error(`[CRON] ❌ Failed to compute prices for hotel ${hotelId}`, {
        error: error.message,
      });
    }
  }
}
