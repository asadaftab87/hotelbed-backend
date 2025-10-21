import { Router } from 'express';
import { env } from '@config/globals';
import { registerApiRoutes } from './components';
import registerErrorHandler from '@middlewares/errorHandler';
import registerMiddleware from '@middlewares/Register';
import { metricsService } from '@/services/metrics.service';
import Logger from '@/core/Logger';

/**
 * Init Express REST routes
 *
 * @param {Router} router
 * @returns {void}
 */
export function initRestRoutes(router: Router): void {
  const prefix = `/api/${env.API_VERSION}`;
  const appRoutesPrefix = `/api/app/${env.API_VERSION}`;
  const superAdminPrefix = `/api/${env.API_VERSION}/superadmin`;
  const adminPrefix = `/api/${env.API_VERSION}/admin`;
  const userPrefix = `/api/${env.API_VERSION}/user`;
  
  Logger.info(`Initializing REST routes on ${prefix}`);
  
  // Metrics endpoint (before middleware)
  router.get('/metrics', metricsService.getMetricsHandler());
  
  // Metrics tracking middleware
  router.use(metricsService.trackHttpRequest());
  
  registerMiddleware(router);
  registerApiRoutes(router, prefix, appRoutesPrefix, superAdminPrefix, adminPrefix, userPrefix);
  registerErrorHandler(router);
}
