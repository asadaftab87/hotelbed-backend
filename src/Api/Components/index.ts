import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { NotFoundError } from '@/core/ApiError';
import { HotelBedRoutes } from './hotelBed/hotelBed.routes';
import { addTraceId } from '@middlewares/cacheAside';
import { setupSwagger } from '@middlewares/swagger';
import monitoringController from '@/controllers/monitoringController';
import Logger from '@/core/Logger';

export const registerApiRoutes = (
  router: Router,
  prefix = '',
  appRoutesPrefix = '',
  superAdminPrefix = '',
  adminPrefix = '',
  userPrefix = ''
): void => {
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
   */
  router.get(prefix, (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Hotel Bed Backend API v1.0.0',
      status: 'running',
      version: '1.0.0',
      endpoints: {
        documentation: `${req.protocol}://${req.get('host')}${prefix}/docs`,
        hotelbed: `${req.protocol}://${req.get('host')}${prefix}/hotelbed`,
        monitoring: `${req.protocol}://${req.get('host')}${prefix}/monitoring`,
        metrics: `${req.protocol}://${req.get('host')}/metrics`,
      },
    });
  });

  // Swagger Documentation
  const docsRouter = express.Router();
  setupSwagger(docsRouter);
  router.use(`${prefix}`, docsRouter);

  // API Routes
  Logger.info(`Registering routes on ${prefix}`);
  router.use(`${prefix}/hotelbed`, new HotelBedRoutes().router);
  
  // Monitoring routes
  router.get(`${prefix}/monitoring/health`, monitoringController.healthCheck.bind(monitoringController));
  router.get(`${prefix}/monitoring/health/detailed`, monitoringController.detailedHealthCheck.bind(monitoringController));
  router.get(`${prefix}/monitoring/metrics`, monitoringController.systemMetrics.bind(monitoringController));
  router.get(`${prefix}/monitoring/stats`, monitoringController.appStats.bind(monitoringController));
  router.post(`${prefix}/monitoring/cache/clear`, monitoringController.clearCache.bind(monitoringController));

  // User-specific routes
  if (userPrefix) {
    Logger.info(`Registering user routes on ${userPrefix}`);
    // router.use(`${userPrefix}/profile`, new UserRoutes().router);
  }

  // Admin routes
  if (adminPrefix) {
    Logger.info(`Registering admin routes on ${adminPrefix}`);
    // router.use(`${adminPrefix}/dashboard`, new AdminRoutes().router);
  }

  // SuperAdmin routes
  if (superAdminPrefix) {
    Logger.info(`Registering superadmin routes on ${superAdminPrefix}`);
    // router.use(`${superAdminPrefix}/settings`, new SuperAdminRoutes().router);
  }

  // 404 handler
  router.use((req: Request, res: Response, next: NextFunction) => next(new NotFoundError()));
};
