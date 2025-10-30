import { Router } from 'express';
import { HotelBedFileController } from './hotelBed.controller';
import { cacheMiddleware } from '@/middlewares/cache';

export class HotelBedRoutes {
  readonly router: Router = Router();
  readonly controller: HotelBedFileController = new HotelBedFileController();

  constructor() {
    this.initRoutes();
  }

  initRoutes(): void {
    /**
     * Complete process: Download + Extract + Import
     * GET /hotelbed/process
     * No cache - processing endpoint
     */
    this.router.get(
      '/process',
      this.controller.processData
    );

    /**
     * Update process: Download Update + Extract + Import (Incremental Update)
     * GET /hotelbed/update
     * No cache - processing endpoint
     */
    this.router.get(
      '/update',
      this.controller.updateData
    );

    /**
     * Direct import from existing extracted folder (Development only)
     * GET /hotelbed/import-only
     * Query: ?folder=folder_name (optional)
     * No cache - processing endpoint
     */
    this.router.get(
      '/import-only',
      this.controller.importOnly
    );

    /**
     * Get hotels with optional pagination and filters
     * GET /hotelbed/hotels
     * Cache: 10 minutes (600s) - frequently accessed
     */
    this.router.get(
      '/hotels',
      cacheMiddleware(600),
      this.controller.getHotels
    );

    /**
     * Get single hotel by ID
     * GET /hotelbed/hotels/:hotelId
     * Cache: 30 minutes (1800s) - static data
     */
    this.router.get(
      '/hotels/:hotelId',
      cacheMiddleware(1800),
      this.controller.getHotelById
    );

    /**
     * Get hotel rates with pagination
     * GET /hotelbed/hotels/:hotelId/rates
     * Cache: 5 minutes (300s) - semi-dynamic data
     */
    this.router.get(
      '/hotels/:hotelId/rates',
      cacheMiddleware(300),
      this.controller.getHotelRates
    );

    /**
     * Get destinations with pagination
     * GET /hotelbed/destinations
     * Cache: 1 hour (3600s) - rarely changes
     */
    this.router.get(
      '/destinations',
      cacheMiddleware(3600),
      this.controller.getDestinations
    );

    /**
     * Get database statistics
     * GET /hotelbed/stats
     * Cache: 5 minutes (300s) - updated periodically
     */
    this.router.get(
      '/stats',
      cacheMiddleware(300),
      this.controller.getDatabaseStats
    );

    /**
     * Compute cheapest prices per person
     * POST /hotelbed/compute-prices
     * Query params: category (CITY_TRIP|OTHER|ALL), hotel_id (optional)
     * No cache - heavy computation endpoint
     */
    this.router.post(
      '/compute-prices',
      this.controller.computePrices
    );

    /**
     * Search hotels with cheapest prices
     * GET /hotelbed/search
     * Query params: destination, category, name, priceMin, priceMax, sort, page, limit
     * Cache: 10 minutes (600s) - frequently searched
     */
    this.router.get(
      '/search',
      cacheMiddleware(600),
      this.controller.searchHotels
    );

    /**
     * Get available rooms for a hotel
     * GET /hotelbed/hotels/:hotelId/available-rooms
     * Query params: checkIn (optional), nights (optional)
     * Cache: 5 minutes (300s)
     */
    this.router.get(
      '/hotels/:hotelId/available-rooms',
      cacheMiddleware(300),
      this.controller.getAvailableRooms
    );

    /**
     * Check availability for specific room and dates
     * GET /hotelbed/check-availability
     * Query params: hotel_id, room_code, checkIn, nights (all required)
     * Cache: 2 minutes (120s)
     */
    this.router.get(
      '/check-availability',
      cacheMiddleware(120),
      this.controller.checkAvailability
    );
  }
}
