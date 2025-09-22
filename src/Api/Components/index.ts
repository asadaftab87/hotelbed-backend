import { Router, Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../../core/ApiError';
import { HotelBedRoutes } from './hotelBed/hotelBed.routes';
// import { AccessRoutes } from './access/access.routes';
// import { CoupleRoutes } from './couple/couple.routes';


export const registerApiRoutes = (router: Router, prefix = '', appRoutesPrefix = '', superAdminPrefix = '', adminPrefix = '', userPrefix = ''): void => {

  router.get(prefix, (req: Request, res: Response) => res.send('Wedding Sponsor Backend Server V1 Running ❤'));
  // router.use(`${prefix}/auth`, new AccessRoutes().router)
  // router.use(`${prefix}/couple`, new CoupleRoutes().router)
  router.use(`${prefix}/hotelbed`, new HotelBedRoutes().router)

  router.use((req: Request, res: Response, next: NextFunction) => next(new NotFoundError()));
}
