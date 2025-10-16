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
      host: process.env.DB_HOST || 'hotelbed.c2hokug86b13.us-east-1.rds.amazonaws.com',
      user: process.env.DB_USER || 'asadaftab',
      password: process.env.DB_PASSWORD || 'Asad12345$',
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
    failed: number; // Note: "failed" is actually "skipped" (no price/inventory data)
    duration: number;
  }> {
    const startTime = Date.now();
    Logger.info('⚡ Starting ULTRA-FAST precompute (BULK MODE)...');
    Logger.info(`⚡ Horizon: ${this.config.horizonDays} days`);

    try {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + this.config.horizonDays);
      
      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // STEP 1: Fetch ALL hotels (1 query)
      Logger.info('📊 Step 1/5: Fetching all hotels...');
      const [hotels] = await this.pool.execute<any[]>(`
        SELECT DISTINCT hotelCode, accommodationType, destinationCode 
        FROM HotelMaster 
        WHERE hotelCode IS NOT NULL
      `);
      Logger.info(`   ✅ Found ${hotels.length.toLocaleString()} hotels`);

      // STEP 2: Fetch ALL supplement prices (1 query - SUPER FAST!)
      Logger.info('💰 Step 2/5: Fetching all prices...');
      const [supplements] = await this.pool.execute<any[]>(`
        SELECT 
          con.hotelCode,
          AVG(s.amountSupplement) as avgPrice
        FROM Supplement s
        INNER JOIN Contract con ON s.hotelBedId = con.hotelBedId
        WHERE s.startDate <= ?
          AND s.endDate >= ?
          AND s.amountSupplement IS NOT NULL
          AND s.amountSupplement > 0
        GROUP BY con.hotelCode
      `, [futureDateStr, todayStr]);
      
      const priceMap = new Map(
        supplements.map((s: any) => [s.hotelCode, parseFloat(s.avgPrice)])
      );
      Logger.info(`   ✅ Found prices for ${priceMap.size.toLocaleString()} hotels`);

      // STEP 3: Fetch ALL inventory (1 query - SUPER FAST!)
      Logger.info('📦 Step 3/5: Fetching inventory...');
      const [inventory] = await this.pool.execute<any[]>(`
        SELECT 
          hotelCode,
          MIN(calendarDate) as firstDate,
          roomCode,
          ratePlanId,
          COUNT(*) as dayCount
        FROM Inventory 
        WHERE calendarDate >= ? 
          AND calendarDate <= ?
          AND (stopSale IS NULL OR stopSale = 0)
        GROUP BY hotelCode, roomCode, ratePlanId
        HAVING COUNT(*) >= ?
      `, [todayStr, futureDateStr, this.config.cityMinNights]);
      
      const inventoryMap = new Map(
        inventory.map((i: any) => [i.hotelCode, {
          firstDate: i.firstDate,
          roomCode: i.roomCode,
          ratePlanId: i.ratePlanId,
          dayCount: i.dayCount
        }])
      );
      Logger.info(`   ✅ Found inventory for ${inventoryMap.size.toLocaleString()} hotels`);

      // STEP 4: Process in-memory (BLAZING FAST!)
      Logger.info('⚡ Step 4/5: Processing in-memory...');
      const priceEntries: any[] = [];
      let processed = 0;
      let skipped = 0;

      for (const hotel of hotels) {
        const basePrice = priceMap.get(hotel.hotelCode);
        const inv = inventoryMap.get(hotel.hotelCode);
        
        if (!basePrice || !inv) {
          skipped++;
          continue;
        }

        const categories = this.determineCategories(hotel);
        
        for (const category of categories) {
          const minNights = category.minNights;
          
          if (inv.dayCount >= minNights) {
            const totalPrice = basePrice * minNights;
            const pricePP = totalPrice / 2;

            priceEntries.push({
              id: randomUUID(),
              hotelCode: hotel.hotelCode,
              categoryTag: category.tag,
              startDate: inv.firstDate,
              nights: minNights,
              boardCode: 'RO',
              pricePP: pricePP.toFixed(2),
              currency: 'EUR',
              ratePlanId: inv.ratePlanId,
              roomCode: inv.roomCode
            });
          }
        }
        
        processed++;
      }

      Logger.info(`   ✅ Generated ${priceEntries.length.toLocaleString()} price entries`);
      Logger.info(`   ⚠️  Skipped ${skipped.toLocaleString()} hotels (no price/inventory)`);

      // STEP 5: Batch insert (FAST!)
      Logger.info('💾 Step 5/5: Inserting into database...');
      await this.pool.execute('DELETE FROM CheapestPricePerPerson');
      
      const BATCH_SIZE = 5000;
      let inserted = 0;
      
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
        `, values);

        inserted += batch.length;
        if (inserted % 10000 === 0 || inserted >= priceEntries.length) {
          Logger.info(`   Inserted: ${inserted.toLocaleString()}/${priceEntries.length.toLocaleString()}`);
        }
      }

      const duration = (Date.now() - startTime) / 1000;

      Logger.info('\n' + '═'.repeat(60));
      Logger.info('🎉 ULTRA-FAST PRECOMPUTE COMPLETE!');
      Logger.info('═'.repeat(60));
      Logger.info(`✅ Processed: ${processed.toLocaleString()} hotels`);
      Logger.info(`✅ Inserted: ${priceEntries.length.toLocaleString()} prices`);
      Logger.info(`⚠️  Skipped: ${skipped.toLocaleString()} hotels (no price/inventory data)`);
      Logger.info(`⏱️  Duration: ${duration.toFixed(2)}s`);
      Logger.info(`⚡ Speed: ${(processed / duration).toFixed(0)} hotels/sec`);
      Logger.info('═'.repeat(60) + '\n');

      return { processed, updated: priceEntries.length, failed: skipped, duration };
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
          CASE 
            WHEN MIN(c.pricePP) IS NOT NULL THEN 1
            ELSE 0
          END as hasAvailability,
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

