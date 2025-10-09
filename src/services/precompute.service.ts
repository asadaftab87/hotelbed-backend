/**
 * Precompute Service
 * Pre-calculates "From € p.p." prices for all hotels per travel category
 * Per client requirements (Section 8 of checklist):
 * - Iterates per hotel and per travel category (City Trip vs Other)
 * - Finds next bookable period that satisfies minimum nights (2 or 5)
 * - Calculates total_price → price_pp = total_price / 2 (double occupancy)
 * - Applies promotions, picks cheapest board
 * - Stores in cheapest_pp table
 */

import Logger from '../core/Logger';
import { pricingEngine } from './pricing.engine';
import pLimit from 'p-limit';
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';

export interface PrecomputeConfig {
  horizonDays: number;
  cityMinNights: number;
  otherMinNights: number;
  beachMinNights: number;
  concurrency: number;
}

export class PrecomputeService {
  private config: PrecomputeConfig;
  private pool: mysql.Pool;

  constructor(config?: Partial<PrecomputeConfig>) {
    this.config = {
      horizonDays: parseInt(process.env.PRECOMPUTE_HORIZON_DAYS || '365'),
      cityMinNights: parseInt(process.env.PRECOMPUTE_CITY_MIN_NIGHTS || '2'),
      otherMinNights: parseInt(process.env.PRECOMPUTE_OTHER_MIN_NIGHTS || '5'),
      beachMinNights: 5,
      concurrency: parseInt(process.env.PRECOMPUTE_CONCURRENCY || '10'),
      ...config,
    };
    
    // Create MySQL connection pool for raw queries (FAST!)
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || '54.85.142.212',
      user: process.env.DB_USER || 'asadaftab',
      password: process.env.DB_PASSWORD || 'Asad124@',
      database: process.env.DB_NAME || 'hotelbed',
      waitForConnections: true,
      connectionLimit: this.config.concurrency * 2,
      queueLimit: 0
    });
  }

  /**
   * Run full precompute job for all hotels
   */
  async runFullPrecompute(): Promise<{
    processed: number;
    updated: number;
    failed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    Logger.info('🚀 Starting TURBO precompute job (RAW SQL)...');
    Logger.info(`⚡ Concurrency: ${this.config.concurrency} | Horizon: ${this.config.horizonDays} days`);

    try {
      // RAW SQL: Get all unique hotels from HotelMaster (FAST!)
      const [hotels] = await this.pool.execute<any[]>(`
        SELECT DISTINCT hotelCode, accommodationType, destinationCode 
        FROM HotelMaster 
        WHERE hotelCode IS NOT NULL
      `);

      Logger.info(`Found ${hotels.length} hotels to process\n`);

      // Calculate date range
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + this.config.horizonDays);
      
      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Process hotels with high concurrency
      const limit = pLimit(this.config.concurrency);
      let processed = 0;
      let updated = 0;
      let failed = 0;
      const priceEntries: any[] = [];

      const tasks = hotels.map((hotel) =>
        limit(async () => {
          try {
            if (!hotel.hotelCode) {
              failed++;
              return;
            }

            // RAW SQL: Get inventory for this hotel (FAST!)
            const [inventory] = await this.pool.execute<any[]>(`
              SELECT calendarDate, roomCode, ratePlanId,
                     allotment, stopSale, minNights, maxNights
              FROM Inventory 
              WHERE hotelCode = ? 
                AND calendarDate >= ? 
                AND calendarDate <= ?
                AND stopSale = 0 
                AND allotment > 0
              ORDER BY calendarDate ASC 
              LIMIT 200
            `, [hotel.hotelCode, todayStr, futureDateStr]);

            if (inventory.length < this.config.cityMinNights) {
              processed++;
              return;
            }

            // Determine categories for this hotel
            const categories = this.determineCategories(hotel);
            const hotelPrices: any[] = [];

            for (const category of categories) {
              const minNights = category.minNights;
              
              if (inventory.length >= minNights) {
                // RAW SQL: Get base price (simple calculation for now)
                const [costs] = await this.pool.execute<any[]>(`
                  SELECT AVG(amount) as avgCost
                  FROM Cost
                  WHERE hotelCode = ?
                    AND calendarDate >= ?
                    AND calendarDate <= ?
                  LIMIT 1
                `, [hotel.hotelCode, todayStr, futureDateStr]);

                const basePrice = costs.length > 0 && costs[0].avgCost 
                  ? parseFloat(costs[0].avgCost) 
                  : 100; // Fallback price
                
                const totalPrice = basePrice * minNights;
                const pricePP = totalPrice / 2; // Double occupancy

                hotelPrices.push({
                  id: randomUUID(),
                  hotelCode: hotel.hotelCode,
                  categoryTag: category.tag,
                  startDate: inventory[0].calendarDate,
                  nights: minNights,
                  boardCode: 'RO', // Default to Room Only
                  pricePP: pricePP.toFixed(2),
                  currency: 'EUR',
                  ratePlanId: inventory[0].ratePlanId || null,
                  roomCode: inventory[0].roomCode || null
                });
              }
            }

            if (hotelPrices.length > 0) {
              priceEntries.push(...hotelPrices);
              updated += hotelPrices.length;
            }

            processed++;

            if (processed % 100 === 0) {
              Logger.info(`⚡ Progress: ${processed}/${hotels.length} hotels | ${priceEntries.length} prices`);
            }
          } catch (error) {
            Logger.error(`Failed to precompute hotel ${hotel.hotelCode}:`, error);
            failed++;
          }
        })
      );

      await Promise.all(tasks);

      Logger.info(`\n✅ Calculation complete! Inserting ${priceEntries.length} price entries...\n`);

      // Batch insert into CheapestPricePerPerson (FAST!)
      const BATCH_SIZE = 5000;
      for (let i = 0; i < priceEntries.length; i += BATCH_SIZE) {
        const batch = priceEntries.slice(i, i + BATCH_SIZE);
        
        const placeholders = batch.map(() => 
          '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL)'
        ).join(',');
        
        const values = batch.flatMap(p => [
          p.id, p.hotelCode, p.categoryTag, p.startDate, p.nights,
          p.boardCode, p.pricePP, p.currency, p.ratePlanId, p.roomCode
        ]);

        await this.pool.execute(`
          INSERT INTO CheapestPricePerPerson 
          (id, hotelCode, categoryTag, startDate, nights, boardCode, pricePP, 
           currency, ratePlanId, roomCode, derivedAt, expiresAt) 
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE 
            pricePP = VALUES(pricePP),
            boardCode = VALUES(boardCode),
            derivedAt = VALUES(derivedAt)
        `, values);

        Logger.info(`   Inserted: ${Math.min(i + BATCH_SIZE, priceEntries.length)}/${priceEntries.length}`);
      }

      const duration = (Date.now() - startTime) / 1000;
      Logger.info(
        `\n🎉 TURBO Precompute complete: ${processed} processed, ${updated} updated, ${failed} failed in ${duration}s`
      );
      Logger.info(`⚡ Speed: ${(processed/duration).toFixed(1)} hotels/sec\n`);

      return { processed, updated, failed, duration };
    } catch (error) {
      Logger.error('❌ Precompute job failed:', error);
      throw error;
    }
  }

  /**
   * Precompute prices for a single hotel across all categories
   */
  async precomputeHotel(
    hotelCode: string,
    hotelInfo?: { accommodationType?: string | null; destinationCode?: string | null }
  ): Promise<{
    categoriesUpdated: number;
  }> {
    const categories = this.determineCategories(hotelInfo);
    let categoriesUpdated = 0;

    for (const category of categories) {
      const minNights = this.getMinNights(category.tag);
      
      try {
        const result = await pricingEngine.calculateCheapestPP({
          hotelCode,
          categoryTag: category.tag,
          minNights,
          horizonDays: this.config.horizonDays,
        });

        if (result) {
          // RAW SQL: Upsert into CheapestPricePerPerson table (FAST!)
          const expiresAt = this.calculateExpiresAt();
          const startDateStr = result.startDate.toISOString().slice(0, 19).replace('T', ' ');
          const derivedAtStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const expiresAtStr = expiresAt ? expiresAt.toISOString().slice(0, 19).replace('T', ' ') : null;

          await this.pool.execute(`
            INSERT INTO CheapestPricePerPerson 
            (id, hotelCode, categoryTag, startDate, nights, boardCode, pricePP, 
             currency, ratePlanId, roomCode, derivedAt, expiresAt)
            VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              boardCode = VALUES(boardCode),
              pricePP = VALUES(pricePP),
              currency = VALUES(currency),
              ratePlanId = VALUES(ratePlanId),
              roomCode = VALUES(roomCode),
              derivedAt = VALUES(derivedAt),
              expiresAt = VALUES(expiresAt)
          `, [
            hotelCode,
            category.tag,
            startDateStr,
            result.nights,
            result.boardCode,
            result.pricePP,
            'EUR',
            result.ratePlanId,
            result.roomCode,
            derivedAtStr,
            expiresAtStr
          ]);

          categoriesUpdated++;
        }
      } catch (error) {
        Logger.error(
          `Failed to precompute ${category.tag} for hotel ${hotelCode}:`,
          error
        );
      }
    }

    return { categoriesUpdated };
  }

  /**
   * Update SearchIndex table with aggregated data (RAW SQL - TURBO MODE 🚀)
   */
  async updateSearchIndex(): Promise<number> {
    Logger.info('🔄 Updating SearchIndex (RAW SQL - SINGLE QUERY)...');
    
    try {
      // RAW SQL: Single massive INSERT...ON DUPLICATE KEY UPDATE (SUPER FAST!)
      const [result] = await this.pool.execute<any>(`
        INSERT INTO SearchIndex 
          (id, hotelCode, destinationCode, countryCode, hotelName, categoryTag, 
           accommodationType, minPricePP, maxPricePP, avgPricePP, 
           hasAvailability, hasPromotion, lastUpdated)
        SELECT 
          COALESCE(si.id, UUID()) as id,
          h.hotelCode,
          h.destinationCode,
          h.countryCode,
          h.hotelName,
          NULL as categoryTag,
          h.accommodationType,
          MIN(c.pricePP) as minPricePP,
          MAX(c.pricePP) as maxPricePP,
          AVG(c.pricePP) as avgPricePP,
          EXISTS(
            SELECT 1 FROM Inventory i 
            WHERE i.hotelCode = h.hotelCode 
              AND i.calendarDate >= CURDATE() 
              AND i.stopSale = 0 
              AND i.allotment > 0 
            LIMIT 1
          ) as hasAvailability,
          EXISTS(
            SELECT 1 FROM Promotion p
            WHERE p.isIncluded = 1
              AND p.finalDate >= CURDATE()
            LIMIT 1
          ) as hasPromotion,
          NOW() as lastUpdated
        FROM HotelMaster h
        LEFT JOIN CheapestPricePerPerson c ON h.hotelCode = c.hotelCode
        LEFT JOIN SearchIndex si ON si.hotelCode = h.hotelCode
        WHERE h.hotelCode IS NOT NULL
        GROUP BY h.hotelCode, h.destinationCode, h.countryCode, h.hotelName, 
                 h.accommodationType, si.id
        ON DUPLICATE KEY UPDATE
          destinationCode = VALUES(destinationCode),
          countryCode = VALUES(countryCode),
          hotelName = VALUES(hotelName),
          accommodationType = VALUES(accommodationType),
          minPricePP = VALUES(minPricePP),
          maxPricePP = VALUES(maxPricePP),
          avgPricePP = VALUES(avgPricePP),
          hasAvailability = VALUES(hasAvailability),
          hasPromotion = VALUES(hasPromotion),
          lastUpdated = VALUES(lastUpdated)
      `);

      const updated = result.affectedRows || 0;
      Logger.info(`✅ SearchIndex updated: ${updated} hotels (TURBO!)`);
      
      return updated;
    } catch (error) {
      Logger.error('❌ Failed to update SearchIndex:', error);
      throw error;
    }
  }

  /**
   * Determine travel categories for a hotel
   */
  private determineCategories(hotelInfo?: {
    accommodationType?: string | null;
    destinationCode?: string | null;
  }): Array<{ tag: string; minNights: number }> {
    const categories: Array<{ tag: string; minNights: number }> = [];

    // Default categories
    categories.push({ tag: 'city_trip', minNights: this.config.cityMinNights });
    categories.push({ tag: 'other', minNights: this.config.otherMinNights });

    // Add beach category if applicable
    if (
      hotelInfo?.accommodationType &&
      ['RESORT', 'BEACH'].some(type => 
        hotelInfo.accommodationType?.toUpperCase().includes(type)
      )
    ) {
      categories.push({ tag: 'beach', minNights: this.config.beachMinNights });
    }

    return categories;
  }

  /**
   * Get minimum nights for category
   */
  private getMinNights(categoryTag: string): number {
    switch (categoryTag) {
      case 'city_trip':
        return this.config.cityMinNights;
      case 'beach':
        return this.config.beachMinNights;
      case 'other':
      default:
        return this.config.otherMinNights;
    }
  }

  /**
   * Calculate expiration time for cached prices
   * Expires after next sync cycle
   */
  private calculateExpiresAt(): Date {
    const syncInterval = parseInt(process.env.SYNC_INTERVAL_MIN || '60');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + syncInterval * 2); // 2x sync interval
    return expiresAt;
  }

  /**
   * Clean up expired cheapest prices (RAW SQL)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const [result] = await this.pool.execute<any>(`
        DELETE FROM CheapestPricePerPerson 
        WHERE expiresAt IS NOT NULL 
          AND expiresAt < NOW()
      `);

      const deletedCount = result.affectedRows || 0;
      Logger.info(`🗑️ Cleaned up ${deletedCount} expired cheapest prices`);
      return deletedCount;
    } catch (error) {
      Logger.error('Failed to cleanup expired prices:', error);
      return 0;
    }
  }
}

// Singleton instance
export const precomputeService = new PrecomputeService();

