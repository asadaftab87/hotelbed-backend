import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { SuccessResponse } from '@/core/ApiResponse';
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
      ).send(res);
    }
  );
}
