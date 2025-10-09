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

import { prisma } from '../database';
import Logger from '../core/Logger';
import { pricingEngine } from './pricing.engine';
import pLimit from 'p-limit';

export interface PrecomputeConfig {
  horizonDays: number;
  cityMinNights: number;
  otherMinNights: number;
  beachMinNights: number;
  concurrency: number;
}

export class PrecomputeService {
  private config: PrecomputeConfig;

  constructor(config?: Partial<PrecomputeConfig>) {
    this.config = {
      horizonDays: parseInt(process.env.PRECOMPUTE_HORIZON_DAYS || '365'),
      cityMinNights: parseInt(process.env.PRECOMPUTE_CITY_MIN_NIGHTS || '2'),
      otherMinNights: parseInt(process.env.PRECOMPUTE_OTHER_MIN_NIGHTS || '5'),
      beachMinNights: 5,
      concurrency: parseInt(process.env.PRECOMPUTE_CONCURRENCY || '10'),
      ...config,
    };
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
    Logger.info('🔄 Starting full precompute job...');

    try {
      // Get all unique hotels from HotelMaster
      const hotels = await prisma.hotelMaster.findMany({
        select: {
          hotelCode: true,
          accommodationType: true,
          destinationCode: true,
        },
        distinct: ['hotelCode'],
      });

      Logger.info(`Found ${hotels.length} hotels to process`);

      // Process hotels with concurrency limit
      const limit = pLimit(this.config.concurrency);
      let processed = 0;
      let updated = 0;
      let failed = 0;

      const tasks = hotels.map((hotel) =>
        limit(async () => {
          try {
            if (!hotel.hotelCode) {
              failed++;
              return;
            }

            const result = await this.precomputeHotel(hotel.hotelCode, hotel);
            processed++;
            updated += result.categoriesUpdated;

            if (processed % 100 === 0) {
              Logger.info(`Progress: ${processed}/${hotels.length} hotels processed`);
            }
          } catch (error) {
            Logger.error(`Failed to precompute hotel ${hotel.hotelCode}:`, error);
            failed++;
          }
        })
      );

      await Promise.all(tasks);

      const duration = (Date.now() - startTime) / 1000;
      Logger.info(
        `✅ Precompute complete: ${processed} processed, ${updated} updated, ${failed} failed in ${duration}s`
      );

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
          // Upsert into CheapestPricePerPerson table
          await prisma.cheapestPricePerPerson.upsert({
            where: {
              hotelCode_categoryTag_startDate_nights: {
                hotelCode,
                categoryTag: category.tag,
                startDate: result.startDate,
                nights: result.nights,
              },
            },
            update: {
              boardCode: result.boardCode,
              pricePP: result.pricePP,
              currency: 'EUR',
              ratePlanId: result.ratePlanId,
              roomCode: result.roomCode,
              derivedAt: new Date(),
              expiresAt: this.calculateExpiresAt(),
            },
            create: {
              hotelCode,
              categoryTag: category.tag,
              startDate: result.startDate,
              nights: result.nights,
              boardCode: result.boardCode,
              pricePP: result.pricePP,
              currency: 'EUR',
              ratePlanId: result.ratePlanId,
              roomCode: result.roomCode,
              derivedAt: new Date(),
              expiresAt: this.calculateExpiresAt(),
            },
          });

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
   * Update SearchIndex table with aggregated data
   */
  async updateSearchIndex(): Promise<number> {
    Logger.info('🔄 Updating SearchIndex...');
    
    try {
      // Get all hotels with their cheapest prices
      const hotelPrices = await prisma.$queryRaw<any[]>`
        SELECT 
          h.hotelCode,
          h.destinationCode,
          h.countryCode,
          h.hotelName,
          h.hotelCategory as rating,
          h.chainCode,
          h.accommodationType,
          h.latitude,
          h.longitude,
          MIN(c.pricePP) as minPricePP,
          MAX(c.pricePP) as maxPricePP,
          AVG(c.pricePP) as avgPricePP,
          MAX(c.derivedAt) as lastUpdated
        FROM HotelMaster h
        LEFT JOIN CheapestPricePerPerson c ON h.hotelCode = c.hotelCode
        GROUP BY h.hotelCode
      `;

      let updated = 0;

      for (const hotel of hotelPrices) {
        if (!hotel.hotelCode) continue;

        // Check if hotel has any availability
        const hasAvailability = await prisma.inventory.count({
          where: {
            hotelCode: hotel.hotelCode,
            calendarDate: {
              gte: new Date(),
            },
            stopSale: false,
            allotment: {
              gt: 0,
            },
          },
          take: 1,
        });

        // Check for active promotions
        const hasPromotion = await prisma.promotion.count({
          where: {
            isIncluded: true,
            finalDate: {
              gte: new Date(),
            },
          },
          take: 1,
        });

        // Upsert SearchIndex
        await prisma.searchIndex.upsert({
          where: {
            hotelCode: hotel.hotelCode,
          },
          update: {
            destinationCode: hotel.destinationCode,
            countryCode: hotel.countryCode,
            hotelName: hotel.hotelName,
            rating: hotel.rating ? parseFloat(hotel.rating) : null,
            chainCode: hotel.chainCode,
            accommodationType: hotel.accommodationType,
            latitude: hotel.latitude ? parseFloat(hotel.latitude) : null,
            longitude: hotel.longitude ? parseFloat(hotel.longitude) : null,
            minPricePP: hotel.minPricePP,
            maxPricePP: hotel.maxPricePP,
            avgPricePP: hotel.avgPricePP,
            hasAvailability: hasAvailability > 0,
            hasPromotion: hasPromotion > 0,
            lastUpdated: new Date(),
          },
          create: {
            hotelCode: hotel.hotelCode,
            destinationCode: hotel.destinationCode,
            countryCode: hotel.countryCode,
            hotelName: hotel.hotelName,
            rating: hotel.rating ? parseFloat(hotel.rating) : null,
            chainCode: hotel.chainCode,
            accommodationType: hotel.accommodationType,
            latitude: hotel.latitude ? parseFloat(hotel.latitude) : null,
            longitude: hotel.longitude ? parseFloat(hotel.longitude) : null,
            minPricePP: hotel.minPricePP,
            maxPricePP: hotel.maxPricePP,
            avgPricePP: hotel.avgPricePP,
            hasAvailability: hasAvailability > 0,
            hasPromotion: hasPromotion > 0,
            lastUpdated: new Date(),
          },
        });

        updated++;
      }

      Logger.info(`✅ SearchIndex updated: ${updated} hotels`);
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
   * Clean up expired cheapest prices
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await prisma.cheapestPricePerPerson.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      Logger.info(`🗑️ Cleaned up ${result.count} expired cheapest prices`);
      return result.count;
    } catch (error) {
      Logger.error('Failed to cleanup expired prices:', error);
      return 0;
    }
  }
}

// Singleton instance
export const precomputeService = new PrecomputeService();

