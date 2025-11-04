import cron from 'node-cron';
import axios from 'axios';
import Logger from '@/core/Logger';
import { env } from '@config/globals';
import pool from '@config/database';

const API_BASE_URL = `http://localhost:${env.PORT}/api/${env.API_VERSION}/hotelbed`;

let fullSyncRunning = false;
let updateSyncRunning = false;

async function validateStagingData(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const connection = await pool.getConnection();

  try {
    const [hotelCount]: any = await connection.query('SELECT COUNT(*) as count FROM hotels_staging');
    if (hotelCount[0].count < 20000) {
      errors.push(`Hotels count too low: ${hotelCount[0].count}`);
    }

    const [ratesCount]: any = await connection.query('SELECT COUNT(*) as count FROM hotel_rates_staging');
    if (ratesCount[0].count < 15000) {
      errors.push(`Rates count too low: ${ratesCount[0].count}`);
    }

    const [nullNames]: any = await connection.query('SELECT COUNT(*) as count FROM hotels_staging WHERE name IS NULL');
    if (nullNames[0].count > 0) {
      errors.push(`Found ${nullNames[0].count} NULL names`);
    }

    return { valid: errors.length === 0, errors };
  } finally {
    connection.release();
  }
}

async function atomicSwapTables(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      RENAME TABLE 
        hotels TO hotels_old, hotels_staging TO hotels,
        hotel_rates TO hotel_rates_old, hotel_rates_staging TO hotel_rates,
        hotel_contracts TO hotel_contracts_old, hotel_contracts_staging TO hotel_contracts
    `);
    Logger.info('[CRON] ✅ Atomic swap completed');
  } catch (error) {
    Logger.error('[CRON] ❌ Swap failed', error);
    throw error;
  } finally {
    connection.release();
  }
}

export const fullSyncJob = cron.schedule(
  '0 0 * * *',
  async () => {
  if (fullSyncRunning) {
    Logger.warn('[CRON] Full sync already running - skipping');
    return;
  }

  fullSyncRunning = true;
  const startTime = Date.now();
  const jobId = `FULL_${Date.now()}`;

  Logger.info('[CRON] ========================================');
  Logger.info(`[CRON] FULL SYNC START - ${jobId}`);
  Logger.info('[CRON] ========================================');

  try {
    Logger.info('[CRON] Step 1: Download & import to STAGING');
    await axios.get(`${API_BASE_URL}/process`, { timeout: 3600000 });

    Logger.info('[CRON] Step 2: Validate staging data');
    const validation = await validateStagingData();

    if (!validation.valid) {
      Logger.error('[CRON] ❌ VALIDATION FAILED');
      validation.errors.forEach(err => Logger.error(`[CRON]   ${err}`));
      Logger.error('[CRON] ❌ ABORTED - Production preserved');
      return;
    }

    Logger.info('[CRON] Step 3: Atomic swap to production');
    await atomicSwapTables();

    Logger.info('[CRON] Step 4: Compute cheapest prices with hotel details');
    const connection = await pool.getConnection();
    try {
      // Truncate old prices
      await connection.query('TRUNCATE TABLE cheapest_pp');

      // Compute CITY_TRIP (2 nights)
      await connection.query(`
        INSERT INTO cheapest_pp 
        (hotel_id, hotel_name, destination_code, country_code, hotel_category, 
         category_tag, start_date, nights, board_code, room_code, 
         price_pp, total_price, currency, has_promotion)
        SELECT 
          h.id, h.name, h.destination_code, h.country_code, h.category,
          'CITY_TRIP', MIN(r.date_from), 2, 'RO', 'STD',
          ROUND(MIN(r.price) * 2 / 2, 2), ROUND(MIN(r.price) * 2, 2), 'EUR', 0
        FROM hotel_rates r
        JOIN hotels h ON r.hotel_id = h.id
        WHERE r.price > 0
        GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category
      `);

      // Compute OTHER (5 nights)
      await connection.query(`
        INSERT INTO cheapest_pp 
        (hotel_id, hotel_name, destination_code, country_code, hotel_category,
         category_tag, start_date, nights, board_code, room_code, 
         price_pp, total_price, currency, has_promotion)
        SELECT 
          h.id, h.name, h.destination_code, h.country_code, h.category,
          'OTHER', MIN(r.date_from), 5, 'RO', 'STD',
          ROUND(MIN(r.price) * 5 / 2, 2), ROUND(MIN(r.price) * 5, 2), 'EUR', 0
        FROM hotel_rates r
        JOIN hotels h ON r.hotel_id = h.id
        WHERE r.price > 0
        GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category
      `);

      const [result]: any = await connection.query('SELECT COUNT(*) as count FROM cheapest_pp');
      Logger.info(`[CRON] ✅ Computed ${result[0].count} cheapest prices`);
    } finally {
      connection.release();
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    Logger.info('[CRON] ========================================');
    Logger.info(`[CRON] ✅ FULL SYNC COMPLETE - ${duration}min`);
    Logger.info('[CRON] ========================================');

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    Logger.error('[CRON] ========================================');
    Logger.error(`[CRON] ❌ FULL SYNC FAILED - ${duration}min`);
    Logger.error('[CRON] Error:', error.message);
    Logger.error('[CRON] ========================================');
  } finally {
    fullSyncRunning = false;
  }
  },
  {
    scheduled: false,
    timezone: process.env.CRON_TIMEZONE || 'UTC',
  } as any
);

export const updateSyncJob = cron.schedule(
  '0 * * * *',
  async () => {
  if (updateSyncRunning || fullSyncRunning) {
    Logger.warn('[CRON] Sync already running - skipping update');
    return;
  }

  updateSyncRunning = true;
  const startTime = Date.now();

  Logger.info('[CRON] UPDATE SYNC START');

  try {
    await axios.get(`${API_BASE_URL}/update`, { timeout: 1800000 });

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    Logger.info(`[CRON] ✅ UPDATE SYNC COMPLETE - ${duration}min`);

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    Logger.error(`[CRON] ❌ UPDATE SYNC FAILED - ${duration}min`);
    Logger.error('[CRON] Error:', error.message);
  } finally {
    updateSyncRunning = false;
  }
  },
  {
    scheduled: false,
    timezone: process.env.CRON_TIMEZONE || 'UTC',
  } as any
);

export const startCronJobs = (): void => {
  if (process.env.ENABLE_CRON !== 'true') {
    Logger.info('[CRON] Disabled (ENABLE_CRON=false)');
    return;
  }

  Logger.info('[CRON] ========================================');
  Logger.info('[CRON] Starting cron jobs');
  Logger.info('[CRON] Full Sync: Daily at 12 AM');
  Logger.info('[CRON] Update Sync: Every hour');
  Logger.info('[CRON] ========================================');

  fullSyncJob.start();
  updateSyncJob.start();

  Logger.info('[CRON] ✅ Jobs started');
};

export const stopCronJobs = (): void => {
  fullSyncJob.stop();
  updateSyncJob.stop();
  Logger.info('[CRON] ❌ Jobs stopped');
};

export const getCronStatus = () => ({
  enabled: process.env.ENABLE_CRON === 'true',
  fullSync: { running: fullSyncRunning, schedule: '0 0 * * *' },
  updateSync: { running: updateSyncRunning, schedule: '0 * * * *' },
});
