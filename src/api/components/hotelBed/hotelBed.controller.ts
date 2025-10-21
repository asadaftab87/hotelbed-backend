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
   *     summary: Get complete hotel details by ID
   *     description: Fetch complete hotel information with all related data from all tables
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
   *         description: Hotel complete details fetched successfully
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

      new SuccessResponse('Hotel complete details fetched successfully', hotel).send(res);
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
}
