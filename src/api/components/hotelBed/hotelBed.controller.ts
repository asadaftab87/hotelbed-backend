import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { SuccessResponse } from '@/core/ApiResponse';
import { BadRequestError, NotFoundError } from '@/core/ApiError';
import { HotelBedFileService } from './hotelBed.service';

export class HotelBedFileController {
  private readonly service: HotelBedFileService;

  constructor() {
    this.service = new HotelBedFileService();
  }

  /**
   * @swagger
   * /hotelbed/process:
   *   get:
   *     summary: Download, extract, and import HotelBeds cache
   *     description: Complete workflow - Downloads HotelBeds cache, extracts files, and imports data to MySQL database
   *     tags: [HotelBed]
   *     responses:
   *       200:
   *         description: Complete process finished successfully
   */
  processData = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const result = await this.service.downloadCache();

      new SuccessResponse(
        'HotelBeds cache processed and imported to database successfully',
        result
      ).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/import-only:
   *   get:
   *     summary: Import from existing extracted folder (Development only)
   *     description: Directly imports data from already extracted folder in downloads/
   *     tags: [HotelBed]
   *     parameters:
   *       - in: query
   *         name: folder
   *         schema:
   *           type: string
   *         description: Folder name in downloads/ (optional, will use latest if not provided)
   *     responses:
   *       200:
   *         description: Import completed successfully
   */
  importOnly = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const folderName = req.query.folder as string;
      const result = await this.service.importOnly(folderName);

      new SuccessResponse(
        'Data imported successfully from existing folder',
        result
      ).send(res      );
    }
  );

  /**
   * @swagger
   * /hotelbed/hotels:
   *   get:
   *     summary: Get hotels with optional pagination
   *     description: Fetch hotels with optional pagination and filters. If page/limit not provided, returns all hotels.
   *     tags: [HotelBed]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *         description: Page number (optional - if not provided, returns all)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Items per page (optional - if not provided, returns all)
   *       - in: query
   *         name: destination_code
   *         schema:
   *           type: string
   *         description: Filter by destination code
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by category
   *       - in: query
   *         name: country_code
   *         schema:
   *           type: string
   *         description: Filter by country code
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: Search by hotel name
   *     responses:
   *       200:
   *         description: Hotels fetched successfully
   */
  getHotels = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      // Validate pagination parameters if provided
      if (page !== undefined && page < 1) {
        throw new BadRequestError('Page must be greater than 0');
      }
      
      if (limit !== undefined && (limit < 1 || limit > 10000)) {
        throw new BadRequestError('Limit must be between 1 and 10000');
      }

      const filters = {
        destination_code: req.query.destination_code as string,
        category: req.query.category as string,
        chain_code: req.query.chain_code as string,
        country_code: req.query.country_code as string,
        name: req.query.name as string,
      };

      const result = await this.service.getHotels(page, limit, filters);

      new SuccessResponse('Hotels fetched successfully', result).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/hotels/{hotelId}:
   *   get:
   *     summary: Get complete hotel details by ID (ALL data, NO limits)
   *     description: |
   *       Fetch COMPLETE hotel information with ALL related data from all 17 tables:
   *       - Hotel basic info (id, name, category, destination, chain, location, etc.)
   *       - Room allocations (ALL records)
   *       - Rates (ALL records)
   *       - Inventory/Availability (ALL records)
   *       - Contracts (ALL records)
   *       - Cancellation policies (ALL records)
   *       - Supplements/Offers (ALL records)
   *       - Rate tags (ALL records)
   *       - Occupancy rules (ALL records)
   *       - Email settings (ALL records)
   *       - Configurations (ALL records)
   *       - Promotions (ALL records)
   *       - Special requests (ALL records)
   *       - Groups (ALL records)
   *       - Special conditions (ALL records)
   *       - Room features (ALL records)
   *       - Pricing rules (ALL records)
   *       - Tax information (ALL records)
   *       
   *       ⚠️ Note: This endpoint returns ALL data without any limits. Response may be large for hotels with extensive data.
   *     tags: [HotelBed]
   *     parameters:
   *       - in: path
   *         name: hotelId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Hotel ID
   *     responses:
   *       200:
   *         description: Hotel complete details fetched successfully (ALL data)
   *       404:
   *         description: Hotel not found
   */
  getHotelById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const hotelId = parseInt(req.params.hotelId);
      
      if (isNaN(hotelId)) {
        throw new BadRequestError('Invalid hotel ID');
      }

      const hotel = await this.service.getHotelFullDetails(hotelId);

      if (!hotel) {
        throw new NotFoundError('Hotel not found');
      }

      new SuccessResponse('Hotel complete details fetched successfully (ALL data)', hotel).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/hotels/{hotelId}/rates:
   *   get:
   *     summary: Get hotel rates
   *     description: Fetch rates for a specific hotel with pagination
   *     tags: [HotelBed]
   *     parameters:
   *       - in: path
   *         name: hotelId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Hotel ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Items per page
   *     responses:
   *       200:
   *         description: Rates fetched successfully
   */
  getHotelRates = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const hotelId = parseInt(req.params.hotelId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (isNaN(hotelId)) {
        throw new BadRequestError('Invalid hotel ID');
      }

      const result = await this.service.getHotelRates(hotelId, page, limit);

      new SuccessResponse('Hotel rates fetched successfully', result).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/destinations:
   *   get:
   *     summary: Get destinations
   *     description: Fetch all destinations with pagination
   *     tags: [HotelBed]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *         description: Items per page
   *     responses:
   *       200:
   *         description: Destinations fetched successfully
   */
  getDestinations = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await this.service.getDestinations(page, limit);

      new SuccessResponse('Destinations fetched successfully', result).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/stats:
   *   get:
   *     summary: Get database statistics
   *     description: Get count of records in all tables
   *     tags: [HotelBed]
   *     responses:
   *       200:
   *         description: Stats fetched successfully
   */
  getDatabaseStats = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const stats = await this.service.getDatabaseStats();

      new SuccessResponse('Database stats fetched successfully', stats).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/compute-prices:
   *   post:
   *     summary: 🔥 Compute prices for ALL hotels (Maximum Speed)
   *     description: |
   *       Processes ALL hotels with maximum parallelism (5000 at once)
   *     tags: [HotelBed]
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *           enum: [CITY_TRIP, OTHER, ALL]
   *           default: ALL
   *       - in: query
   *         name: hotel_id
   *         schema:
   *           type: integer
   *         description: Optional - Single hotel only
   *     responses:
   *       200:
   *         description: Completed
   */
  computePrices = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const category = (req.query.category as string) || 'ALL';
      const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id as string) : undefined;

      if (hotelId && isNaN(hotelId)) {
        throw new BadRequestError('Invalid hotel ID');
      }

      if (!['CITY_TRIP', 'OTHER', 'ALL'].includes(category)) {
        throw new BadRequestError('Category must be CITY_TRIP, OTHER, or ALL');
      }

      const result = await this.service.computeCheapestPrices(category, hotelId);

      new SuccessResponse('✅ Completed', result).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/search:
   *   get:
   *     summary: Search hotels with cheapest prices
   *     description: |
   *       Search hotels with precomputed cheapest prices per person.
   *       Uses cheapest_pp table for fast results.
   *     tags: [HotelBed]
   *     parameters:
   *       - in: query
   *         name: destination
   *         schema:
   *           type: string
   *         description: Destination code
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *           enum: [CITY_TRIP, OTHER]
   *         description: Travel category
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: Hotel name search
   *       - in: query
   *         name: priceMin
   *         schema:
   *           type: number
   *         description: Minimum price per person
   *       - in: query
   *         name: priceMax
   *         schema:
   *           type: number
   *         description: Maximum price per person
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [price_asc, price_desc, name_asc, name_desc]
   *           default: price_asc
   *         description: Sort order
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: Search results
   */
  searchHotels = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const filters = {
        destination: req.query.destination as string,
        category: req.query.category as string,
        name: req.query.name as string,
        priceMin: req.query.priceMin ? parseFloat(req.query.priceMin as string) : undefined,
        priceMax: req.query.priceMax ? parseFloat(req.query.priceMax as string) : undefined,
      };

      const sort = (req.query.sort as string) || 'price_asc';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.service.searchHotels(filters, sort, page, limit);

      new SuccessResponse('Hotels found', result).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/hotels/{hotelId}/available-rooms:
   *   get:
   *     summary: Get available rooms with dates for a hotel
   *     description: Returns available rooms with their dates and rates (paginated). Shows summary with limited dates per room for performance.
   *     tags: [HotelBed]
   *     parameters:
   *       - in: path
   *         name: hotelId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: checkIn
   *         schema:
   *           type: string
   *           format: date
   *         description: Check-in date (YYYY-MM-DD) - Required with nights
   *       - in: query
   *         name: nights
   *         schema:
   *           type: integer
   *         description: Number of nights - Required with checkIn
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number for rooms
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Rooms per page (max 50)
   *       - in: query
   *         name: maxDates
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Max dates to show per room (default 10)
   *     responses:
   *       200:
   *         description: Available rooms found with summary
   */
  getAvailableRooms = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const hotelId = parseInt(req.params.hotelId);
      const checkIn = req.query.checkIn as string;
      const nights = req.query.nights ? parseInt(req.query.nights as string) : undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Max 50
      const maxDates = Math.min(parseInt(req.query.maxDates as string) || 10, 100); // Max 100

      if (isNaN(hotelId)) {
        throw new BadRequestError('Invalid hotel ID');
      }

      const result = await this.service.getAvailableRooms(hotelId, checkIn, nights, page, limit, maxDates);

      new SuccessResponse('Available rooms found', result).send(res);
    }
  );

  /**
   * @swagger
   * /hotelbed/check-availability:
   *   get:
   *     summary: Get all available rooms for hotel with dates and pricing
   *     description: Returns all available rooms for given check-in date and nights with complete pricing details
   *     tags: [HotelBed]
   *     parameters:
   *       - in: query
   *         name: hotel_id
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: checkIn
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: nights
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: room_code
   *         schema:
   *           type: string
   *         description: Optional - Filter by specific room
   *     responses:
   *       200:
   *         description: Available rooms with pricing
   */
  checkAvailability = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const hotelId = parseInt(req.query.hotel_id as string);
      const checkIn = req.query.checkIn as string;
      const nights = parseInt(req.query.nights as string);
      const roomCode = req.query.room_code as string;

      if (isNaN(hotelId)) {
        throw new BadRequestError('Invalid hotel ID');
      }

      if (!checkIn || isNaN(nights)) {
        throw new BadRequestError('Missing required parameters: checkIn, nights');
      }

      const result = await this.service.checkAvailability(hotelId, checkIn, nights, roomCode);

      new SuccessResponse('Available rooms found', result).send(res);
    }
  );
}
