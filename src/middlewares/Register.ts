import { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import express from 'express';
import logger from '@utils/logger';

export default function registerMiddleware(router: Router): void {
  logger.info('Registering middleware');

  // Security headers
  router.use(helmet());

  // CORS
  router.use(cors());

  // Compression
  router.use(compression());

  // Body parsers
  router.use(express.json());
  router.use(express.urlencoded({ extended: true }));

  // HTTP request logger
  if (process.env.NODE_ENV === 'development') {
    router.use(morgan('dev'));
  }

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.use(limiter);

  // Custom request logger
  router.use((req, res, next) => {
    const start = Date.now();
    logger.http(`${req.method} ${req.path}`);

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.http(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });

    next();
  });
}

