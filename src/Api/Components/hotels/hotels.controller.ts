import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../../../helpers/async';
import { hotelsService } from './hotels.service';
import { prisma } from '../../../database';
import { SuccessResponse } from '../../../core/ApiResponse';
import { BadRequestError, NotFoundError } from '../../../core/ApiError';
import Logger from '../../../core/Logger';

export class HotelsController {
  /**
   * GET /api/v1/hotels
   * Get available hotels list
   */
  getList = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const startTime = Date.now();

      try {
        // Get available hotels from HotelMaster (fallback if SearchIndex not available)
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
        const skip = (page - 1) * pageSize;

        // Try SearchIndex first, fallback to HotelMaster
        let hotels: any[] = [];
        let total = 0;

        try {
          const [rawHotels, totalCount] = await Promise.all([
            prisma.searchIndex.findMany({
              where: {
                hasAvailability: true,
                minPricePP: {
                  not: null,
                },
              },
              select: {
                hotelCode: true,
                hotelName: true,
                minPricePP: true,
                maxPricePP: true,
                avgPricePP: true,
                rating: true,
                countryCode: true,
                destinationCode: true,
                accommodationType: true,
                hasPromotion: true,
              },
              orderBy: {
                minPricePP: 'asc',
              },
              skip,
              take: pageSize,
            }),
            prisma.searchIndex.count({
              where: {
                hasAvailability: true,
                minPricePP: {
                  not: null,
                },
              },
            }),
          ]);
          
          // Convert Decimal to number
          hotels = rawHotels.map(h => ({
            ...h,
            minPricePP: h.minPricePP ? parseFloat(h.minPricePP as any) : null,
            maxPricePP: h.maxPricePP ? parseFloat(h.maxPricePP as any) : null,
            avgPricePP: h.avgPricePP ? parseFloat(h.avgPricePP as any) : null,
            rating: h.rating ? parseFloat(h.rating as any) : null,
          }));
          total = totalCount;
        } catch (searchIndexError) {
          Logger.warn('SearchIndex not available, using HotelMaster fallback');
          // Fallback to HotelMaster
          const [hotelMasterData, hotelMasterTotal] = await Promise.all([
            prisma.hotelMaster.findMany({
              select: {
                hotelCode: true,
                hotelName: true,
                countryCode: true,
                destinationCode: true,
                hotelCategory: true,
                accommodationType: true,
              },
              distinct: ['hotelCode'],
              skip,
              take: pageSize,
            }),
            prisma.hotelMaster.count(),
          ]);

          hotels = hotelMasterData.map(h => ({
            hotelCode: h.hotelCode,
            hotelName: h.hotelName,
            minPricePP: null,
            maxPricePP: null,
            avgPricePP: null,
            rating: null,
            countryCode: h.countryCode,
            destinationCode: h.destinationCode,
            accommodationType: h.accommodationType,
            hasPromotion: false,
          }));
          total = hotelMasterTotal;
        }

        // Enrich hotels with complete details (rooms, availability, costs)
        const enrichedHotels = await hotelsService.enrichHotelsList(hotels);

        const duration = Date.now() - startTime;
        res.setHeader('X-Response-Time', `${duration}ms`);

        new SuccessResponse('Hotels retrieved', {
          hotels: enrichedHotels,
          total,
          page,
          pageSize,
        }).send(res);
      } catch (error) {
        Logger.error('Error in getList:', error);
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/hotels/:id/matrix
   * Get hotel matrix with room details and pricing
   */
  getMatrix = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const startTime = Date.now();
      const { id } = req.params;

      // Parse query parameters
      const checkIn = req.query.checkIn as string;
      const nights = req.query.nights ? parseInt(req.query.nights as string) : undefined;
      const adults = req.query.adults ? parseInt(req.query.adults as string) : 2;
      const children = req.query.children ? parseInt(req.query.children as string) : 0;
      const childAges = req.query.childAges
        ? (req.query.childAges as string).split(',').map(Number)
        : undefined;

      // Validate required parameters
      if (!checkIn) {
        throw new BadRequestError('checkIn is required (format: YYYY-MM-DD)');
      }

      if (!nights) {
        throw new BadRequestError('nights is required');
      }

      // Get matrix
      const result = await hotelsService.getMatrix({
        hotelId: id,
        checkIn,
        nights,
        occupancy: {
          adults,
          children,
          childAges,
        },
      });

      if (!result || result.rooms.length === 0) {
        throw new NotFoundError('No available rooms found for the specified dates');
      }

      // Add performance headers
      const duration = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${duration}ms`);

      Logger.debug(`Matrix completed in ${duration}ms with ${result.rooms.length} rooms`);

      new SuccessResponse('Matrix retrieved', result).send(res);
    }
  );

  /**
   * GET /api/v1/hotels/static
   * Get static hotel data (descriptions, amenities, photos, etc.)
   */
  getStatic = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const startTime = Date.now();

      // Parse hotel IDs (comma-separated or array)
      let hotelIds: string[] = [];
      
      if (req.query.ids) {
        if (Array.isArray(req.query.ids)) {
          hotelIds = req.query.ids as string[];
        } else {
          hotelIds = (req.query.ids as string).split(',').map(id => id.trim());
        }
      }

      if (hotelIds.length === 0) {
        throw new BadRequestError('ids parameter is required (comma-separated hotel IDs)');
      }

      if (hotelIds.length > 50) {
        throw new BadRequestError('Maximum 50 hotel IDs allowed per request');
      }

      // Get static data
      const result = await hotelsService.getStaticData({ hotelIds });

      // Add performance headers
      const duration = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${duration}ms`);

      Logger.debug(`Static data retrieved in ${duration}ms for ${result.hotels.length} hotels`);

      new SuccessResponse('Static data retrieved', result).send(res);
    }
  );

  /**
   * GET /api/v1/hotels/:id
   * Get single hotel static data
   */
  getById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const { id } = req.params;

      const result = await hotelsService.getStaticData({ hotelIds: [id] });

      if (!result.hotels || result.hotels.length === 0) {
        throw new NotFoundError('Hotel not found');
      }

      new SuccessResponse('Hotel retrieved', result.hotels[0]).send(res);
    }
  );
}

