import { Router } from 'express';
import { HotelBedFileController } from './hotelBed.controller';
export class HotelBedRoutes {

  readonly router: Router = Router();
  readonly controller: HotelBedFileController = new HotelBedFileController()

  constructor() {
    this.initRoutes();
  }

  initRoutes(): void {
    this.router.get(
      '/',
      this.controller.getFullData
    )

  }

}
