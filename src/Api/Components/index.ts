import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { NotFoundError } from '../../core/ApiError';
import { HotelBedRoutes } from './hotelBed/hotelBed.routes';
import { SearchRoutes } from './search/search.routes';
import { HotelsRoutes } from './hotels/hotels.routes';
import { addTraceId } from '../../middleware/cacheAside';
import { setupSwagger } from '../../middleware/swagger';
// import { AccessRoutes } from './access/access.routes';
// import { CoupleRoutes } from './couple/couple.routes';


export const registerApiRoutes = (router: Router, prefix = '', appRoutesPrefix = '', superAdminPrefix = '', adminPrefix = '', userPrefix = ''): void => {
  // Add trace ID to all requests
  router.use(addTraceId);

  /**
   * @swagger
   * /:
   *   get:
   *     tags: [System]
   *     summary: API health check
   *     description: Returns server status
   *     responses:
   *       200:
   *         description: Server is running
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   *               example: "Hotel Bed Backend Server V1 Running ❤"
   */
  router.get(prefix, (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Hotelbeds Cache API v1.0.0',
      status: 'running',
      endpoints: {
        documentation: `${req.protocol}://${req.get('host')}/api/v1/docs`,
        search: `${req.protocol}://${req.get('host')}/api/v1/search`,
        hotels: `${req.protocol}://${req.get('host')}/api/v1/hotels`,
        metrics: `${req.protocol}://${req.get('host')}/metrics`,
      },
    });
  });
  
  // Swagger Documentation (must be BEFORE route prefix)
  const docsRouter = express.Router();
  setupSwagger(docsRouter);
  router.use(`${prefix}`, docsRouter);
  
  // Hotelbeds Cache API Routes (per client requirements)
  router.use(`${prefix}/search`, new SearchRoutes().router);
  router.use(`${prefix}/hotels`, new HotelsRoutes().router);
  
  // Legacy/Admin routes
  // router.use(`${prefix}/auth`, new AccessRoutes().router)
  // router.use(`${prefix}/couple`, new CoupleRoutes().router)
  router.use(`${prefix}/hotelbed`, new HotelBedRoutes().router);

  router.use((req: Request, res: Response, next: NextFunction) => next(new NotFoundError()));
}
