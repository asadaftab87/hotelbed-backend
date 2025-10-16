import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../../../helpers/async';
import { searchService } from './search.service';
import { SuccessResponse } from '../../../core/ApiResponse';
import { BadRequestError } from '../../../core/ApiError';
import Logger from '../../../core/Logger';

export class SearchController {
  /**
   * GET /api/v1/search
   * Main search endpoint with filters
   */
  search = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const startTime = Date.now();

      // Parse and validate filters
      const filters = {
        // Location
        destination: req.query.destination as string,
        zone: req.query.zone as string,
        country: req.query.country as string,
        geo: req.query.geo as string,

        // Dates
        checkIn: req.query.checkIn as string,
        checkOut: req.query.checkOut as string,
        nights: req.query.nights ? parseInt(req.query.nights as string) : undefined,

        // Occupancy
        adults: req.query.adults ? parseInt(req.query.adults as string) : 2,
        children: req.query.children ? parseInt(req.query.children as string) : 0,
        childAges: req.query.childAges
          ? (req.query.childAges as string).split(',').map(Number)
          : undefined,

        // Text search
        name: req.query.name as string,

        // Board types
        board: req.query.board
          ? Array.isArray(req.query.board)
            ? (req.query.board as string[])
            : [req.query.board as string]
          : undefined,

        // Hotel characteristics
        category: req.query.category
          ? Array.isArray(req.query.category)
            ? (req.query.category as string[])
            : [req.query.category as string]
          : undefined,
        accommodationType: req.query.accommodationType
          ? Array.isArray(req.query.accommodationType)
            ? (req.query.accommodationType as string[])
            : [req.query.accommodationType as string]
          : undefined,
        ratingMin: req.query.ratingMin ? parseFloat(req.query.ratingMin as string) : undefined,
        chain: req.query.chain
          ? Array.isArray(req.query.chain)
            ? (req.query.chain as string[])
            : [req.query.chain as string]
          : undefined,

        // Amenities
        amenities: req.query.amenities
          ? Array.isArray(req.query.amenities)
            ? (req.query.amenities as string[])
            : [req.query.amenities as string]
          : undefined,
        kidsFacilities: req.query.kidsFacilities === 'true',

        // Location filters
        beachDistanceMax: req.query.beachDistanceMax
          ? parseInt(req.query.beachDistanceMax as string)
          : undefined,
        centerDistanceMax: req.query.centerDistanceMax
          ? parseInt(req.query.centerDistanceMax as string)
          : undefined,

        // Price range
        priceMin: req.query.priceMin ? parseFloat(req.query.priceMin as string) : undefined,
        priceMax: req.query.priceMax ? parseFloat(req.query.priceMax as string) : undefined,

        // Special filters
        lastMinute: req.query.lastMinute === 'true',
        promotion: req.query.promotion === 'true',
        discountTypes: req.query.discountTypes
          ? Array.isArray(req.query.discountTypes)
            ? (req.query.discountTypes as string[])
            : [req.query.discountTypes as string]
          : undefined,

        // Sorting
        sort: req.query.sort as any,

        // Pagination
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
        cursor: req.query.cursor as string,
      };

      // Validate required filters
      if (!filters.destination && !filters.zone && !filters.country && !filters.geo) {
        throw new BadRequestError(
          'At least one location filter required (destination, zone, country, or geo)'
        );
      }

      // Execute search
      const result = await searchService.search(filters);

      // Add performance headers
      const duration = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${duration}ms`);

      Logger.debug(`Search completed in ${duration}ms with ${result.results.length} results`);

      new SuccessResponse('Search completed', result).send(res);
    }
  );

  /**
   * GET /api/v1/search/suggestions
   * Get search suggestions based on query
   */
  suggestions = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        throw new BadRequestError('Query must be at least 2 characters');
      }

      // Get hotel name suggestions
      // This could be enhanced with a dedicated autocomplete index
      const suggestions = await searchService.search({
        name: query,
        pageSize: 10,
      });

      new SuccessResponse('Suggestions retrieved', {
        query,
        suggestions: suggestions.results.map((r) => ({
          hotelCode: r.hotelCode,
          name: r.name,
          fromPricePP: r.fromPricePP,
        })),
      }).send(res);
    }
  );
}

