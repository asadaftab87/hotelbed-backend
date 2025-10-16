import { Router } from 'express';
import { HotelBedFileController } from './hotelBed.controller';
export class HotelBedRoutes {

  readonly router: Router = Router();
  readonly controller: HotelBedFileController = new HotelBedFileController()

  constructor() {
    this.initRoutes();
  }

  initRoutes(): void {
    // Full flow (download + process + precompute + index)
    this.router.get(
      '/',
      this.controller.getFullData
    )

    // Manual inventory build (from current database data)
    this.router.get(
      '/build-inventory',
      this.controller.buildInventory
    )

    // Manual precompute only (after data is in DB)
    this.router.get(
      '/precompute',
      this.controller.runPrecompute
    )

    // Manual search index update (after precompute)
    this.router.get(
      '/search-index',
      this.controller.updateSearchIndex
    )

  }

}
