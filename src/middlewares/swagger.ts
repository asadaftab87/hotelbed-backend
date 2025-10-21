import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from '@config/swagger';
import logger from '@utils/logger';

export const setupSwagger = (router: Router): void => {
  logger.info('Setting up Swagger documentation');

  // Swagger UI
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Hotel Bed API Documentation',
  }));

  // Swagger JSON
  router.get('/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

