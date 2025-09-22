import { Router } from 'express';
import { env } from '../config/globals';

import { registerApiRoutes } from './Components';
import registerErrorHandler from "../middleware/ErrorHandler"
import registerMiddleware from '../middleware/Register';
import Logger from '../core/Logger';

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
  registerMiddleware(router);
  registerApiRoutes(router, prefix, appRoutesPrefix, superAdminPrefix, adminPrefix, userPrefix);
  registerErrorHandler(router);
}
