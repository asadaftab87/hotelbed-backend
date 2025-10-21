import { Router } from 'express';
import { HotelBedFileController } from './hotelBed.controller';

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
     */
    this.router.get(
      '/process',
      this.controller.processData
    );

    /**
     * Direct import from existing extracted folder (Development only)
     * GET /hotelbed/import-only
     * Query: ?folder=folder_name (optional)
     */
    this.router.get(
      '/import-only',
      this.controller.importOnly
    );
  }
}
