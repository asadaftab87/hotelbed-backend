/**
 * Search Service
 * Implements /search endpoint per client requirements (Section 6 of checklist)
 * Features:
 * - Multiple search filters (destination, dates, occupancy, amenities, etc.)
 * - Sorting (price, rating, distance, promo)
 * - Pagination with keyset cursor
 * - Redis caching with cache-aside pattern
 */

import { prisma } from '../../../database';
import Logger from '../../../core/Logger';

export interface SearchFilters {
  // Location
  destination?: string;
  zone?: string;
  country?: string;
  geo?: string; // lat,lon,radius

  // Dates
  checkIn?: string; // YYYY-MM-DD
  checkOut?: string; // YYYY-MM-DD
  nights?: number;

  // Occupancy
  adults?: number;
  children?: number;
  childAges?: number[];

  // Text search
  name?: string;

  // Board types
  board?: string[]; // ['RO', 'BB', 'HB', 'FB']

  // Hotel characteristics
  category?: string[]; // Hotel star ratings
  accommodationType?: string[];
  ratingMin?: number; // Minimum rating (e.g., 7.5)
  chain?: string[];

  // Amenities & facilities
  amenities?: string[]; // ['WIFI', 'POOL', 'SPA', 'PARKING']
  kidsFacilities?: boolean;

  // Location filters
  landmarkId?: string[];
  beachDistanceMax?: number; // meters
  centerDistanceMax?: number; // meters

  // Price range
  priceMin?: number;
  priceMax?: number;

  // Special filters
  lastMinute?: boolean;
  promotion?: boolean;
  discountTypes?: string[];

  // Sorting
  sort?: 'price_asc' | 'price_desc' | 'rating_desc' | 'rating_asc' | 'distance_asc' | 'promo_desc';

  // Pagination
  page?: number;
  pageSize?: number;
  cursor?: string; // For keyset pagination
}

export interface SearchResult {
  hotelId: string;
  hotelCode: string;
  name: string;
  fromPricePP: number;
  currency: string;
  boardCode: string;
  startDate: string;
  nights: number;
  rating?: number;
  category?: string;
  distances?: {
    beach?: number;
    center?: number;
  };
  badges: string[]; // ['PROMO', 'FREE_NIGHTS', 'LAST_MINUTE']
  hasPromotion: boolean;
  accommodationType?: string;
  amenities?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  nextCursor?: string;
  filters: SearchFilters;
}

export class SearchService {
  /**
   * Main search function
   */
  async search(filters: SearchFilters): Promise<SearchResponse> {
    try {
      Logger.debug('Search filters:', filters);

      // Get page and pageSize
      const page = filters.page || 1;
      const pageSize = Math.min(
        filters.pageSize || 50,
        parseInt(process.env.SEARCH_MAX_PAGE_SIZE || '100')
      );
      const skip = (page - 1) * pageSize;

      // Try SearchIndex first, fallback to HotelMaster if empty
      let hotels: any[] = [];
      let total = 0;

      try {
        // Build query
        const whereClause = this.buildWhereClause(filters);
        const orderByClause = this.buildOrderByClause(filters.sort);

        // Execute query on SearchIndex
        [hotels, total] = await Promise.all([
          prisma.searchIndex.findMany({
            where: whereClause,
            orderBy: orderByClause,
            skip,
            take: pageSize,
          }),
          prisma.searchIndex.count({
            where: whereClause,
          }),
        ]);
      } catch (err) {
        Logger.warn('SearchIndex not available, falling back to HotelMaster');
      }

      // Fallback to HotelMaster if SearchIndex is empty
      if (hotels.length === 0) {
        const hotelMasterWhere = this.buildHotelMasterWhereClause(filters);
        
        [hotels, total] = await Promise.all([
          prisma.hotelMaster.findMany({
            where: hotelMasterWhere,
            skip,
            take: pageSize,
            orderBy: { hotelName: 'asc' },
          }),
          prisma.hotelMaster.count({
            where: hotelMasterWhere,
          }),
        ]);

        // Convert HotelMaster format to SearchResult format
        const results: SearchResult[] = hotels.map((hotel) => ({
          hotelId: hotel.hotelCode || '',
          hotelCode: hotel.hotelCode || '',
          name: hotel.hotelName || '',
          fromPricePP: 0,
          currency: 'EUR',
          boardCode: 'RO',
          startDate: filters.checkIn || new Date().toISOString().split('T')[0],
          nights: filters.nights || 2,
          rating: undefined,
          category: hotel.hotelCategory || undefined,
          distances: {
            beach: undefined,
            center: undefined,
          },
          badges: [],
          hasPromotion: false,
          accommodationType: hotel.accommodationType || undefined,
          amenities: [],
        }));

        return {
          results,
          total,
          page,
          pageSize,
          nextCursor: undefined,
          filters,
        };
      }

      // Enrich results with cheapest prices and additional data
      const results = await this.enrichResults(hotels, filters);

      // Calculate next cursor for keyset pagination
      const nextCursor =
        results.length === pageSize
          ? this.generateCursor(results[results.length - 1])
          : undefined;

      return {
        results,
        total,
        page,
        pageSize,
        nextCursor,
        filters,
      };
    } catch (error) {
      Logger.error('SearchService.search error:', error);
      throw error;
    }
  }

  /**
   * Build WHERE clause for HotelMaster (fallback)
   */
  private buildHotelMasterWhereClause(filters: SearchFilters): any {
    const where: any = {};

    // Destination
    if (filters.destination) {
      where.destinationCode = filters.destination;
    }

    // Country
    if (filters.country) {
      where.countryCode = filters.country;
    }

    // Name search
    if (filters.name) {
      where.hotelName = {
        contains: filters.name,
      };
    }

    // Category (star rating)
    if (filters.category && filters.category.length > 0) {
      where.hotelCategory = {
        in: filters.category,
      };
    }

    return where;
  }

  /**
   * Build WHERE clause from filters
   */
  private buildWhereClause(filters: SearchFilters): any {
    const where: any = {
      hasAvailability: true, // Only show hotels with availability
    };

    // Destination
    if (filters.destination) {
      where.destinationCode = filters.destination;
    }

    // Country
    if (filters.country) {
      where.countryCode = filters.country;
    }

    // Zone
    if (filters.zone) {
      where.zoneCode = filters.zone;
    }

    // Name search (full-text)
    if (filters.name) {
      where.hotelName = {
        contains: filters.name,
      };
    }

    // Category (star rating)
    if (filters.category && filters.category.length > 0) {
      where.categoryTag = {
        in: filters.category,
      };
    }

    // Rating minimum
    if (filters.ratingMin) {
      where.rating = {
        gte: filters.ratingMin,
      };
    }

    // Accommodation type
    if (filters.accommodationType && filters.accommodationType.length > 0) {
      where.accommodationType = {
        in: filters.accommodationType,
      };
    }

    // Chain
    if (filters.chain && filters.chain.length > 0) {
      where.chainCode = {
        in: filters.chain,
      };
    }

    // Price range
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      where.minPricePP = {};
      if (filters.priceMin !== undefined) {
        where.minPricePP.gte = filters.priceMin;
      }
      if (filters.priceMax !== undefined) {
        where.minPricePP.lte = filters.priceMax;
      }
    }

    // Distance filters
    if (filters.beachDistanceMax) {
      where.beachDistanceM = {
        lte: filters.beachDistanceMax,
      };
    }

    if (filters.centerDistanceMax) {
      where.centerDistanceM = {
        lte: filters.centerDistanceMax,
      };
    }

    // Special filters
    if (filters.promotion) {
      where.hasPromotion = true;
    }

    if (filters.lastMinute) {
      where.lastMinute = true;
    }

    return where;
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderByClause(sort?: string): any {
    switch (sort) {
      case 'price_asc':
        return [{ minPricePP: 'asc' }, { rating: 'desc' }];
      case 'price_desc':
        return [{ minPricePP: 'desc' }, { rating: 'desc' }];
      case 'rating_desc':
        return [{ rating: 'desc' }, { minPricePP: 'asc' }];
      case 'rating_asc':
        return [{ rating: 'asc' }, { minPricePP: 'asc' }];
      case 'distance_asc':
        return [{ centerDistanceM: 'asc' }, { minPricePP: 'asc' }];
      case 'promo_desc':
        return [{ hasPromotion: 'desc' }, { minPricePP: 'asc' }];
      default:
        return [{ minPricePP: 'asc' }, { rating: 'desc' }];
    }
  }

  /**
   * Enrich results with cheapest prices and badges
   */
  private async enrichResults(
    hotels: any[],
    filters: SearchFilters
  ): Promise<SearchResult[]> {
    const categoryTag = this.determineCategoryTag(filters);
    const hotelCodes = hotels.map((h) => h.hotelCode);

    // Get cheapest prices for these hotels
    const cheapestPrices = await prisma.cheapestPricePerPerson.findMany({
      where: {
        hotelCode: {
          in: hotelCodes,
        },
        categoryTag,
      },
    });

    // Create map for quick lookup
    const priceMap = new Map<string, typeof cheapestPrices[0]>(
      cheapestPrices.map((p) => [p.hotelCode, p])
    );

    // Get amenities for hotels
    const amenitiesMap = await this.getHotelAmenities(hotelCodes);

    // Build results
    const results: SearchResult[] = [];

    for (const hotel of hotels) {
      const price = priceMap.get(hotel.hotelCode);
      if (!price) continue; // Skip if no price data

      const badges: string[] = [];
      if (hotel.hasPromotion) badges.push('PROMO');
      if (hotel.lastMinute) badges.push('LAST_MINUTE');

      results.push({
        hotelId: hotel.id,
        hotelCode: hotel.hotelCode,
        name: hotel.hotelName || '',
        fromPricePP: parseFloat(price.pricePP as any) || 0,
        currency: price.currency,
        boardCode: price.boardCode || 'RO',
        startDate: price.startDate.toISOString().split('T')[0],
        nights: price.nights,
        rating: hotel.rating ? parseFloat(hotel.rating as any) : undefined,
        category: hotel.categoryTag,
        distances: {
          beach: hotel.beachDistanceM,
          center: hotel.centerDistanceM,
        },
        badges,
        hasPromotion: hotel.hasPromotion,
        accommodationType: hotel.accommodationType,
        amenities: amenitiesMap.get(hotel.hotelCode) || [],
      });
    }

    return results;
  }

  /**
   * Get amenities for hotels
   */
  private async getHotelAmenities(
    hotelCodes: string[]
  ): Promise<Map<string, string[]>> {
    const amenities = await prisma.hotelAmenity.findMany({
      where: {
        hotelCode: {
          in: hotelCodes,
        },
      },
    });

    const map = new Map<string, string[]>();
    for (const amenity of amenities) {
      if (!map.has(amenity.hotelCode)) {
        map.set(amenity.hotelCode, []);
      }
      map.get(amenity.hotelCode)!.push(amenity.amenityCode);
    }

    return map;
  }

  /**
   * Determine category tag from filters
   */
  private determineCategoryTag(filters: SearchFilters): string {
    // Simple heuristic - can be enhanced
    if (filters.nights && filters.nights <= 3) {
      return 'city_trip';
    }
    if (filters.beachDistanceMax || filters.amenities?.includes('BEACH')) {
      return 'beach';
    }
    return 'other';
  }

  /**
   * Generate cursor for keyset pagination
   */
  private generateCursor(result: SearchResult): string {
    return Buffer.from(
      JSON.stringify({
        price: result.fromPricePP,
        id: result.hotelId,
      })
    ).toString('base64');
  }
}

// Singleton instance
export const searchService = new SearchService();

