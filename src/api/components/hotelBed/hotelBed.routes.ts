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
  }
}
