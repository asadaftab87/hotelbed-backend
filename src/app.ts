import { config } from 'dotenv';
config();
import { createServer, Server as HttpServer } from 'http';
import express from 'express';
import { port, environment } from '@config/globals';
import { Server } from './api/server';
import Logger from '@/core/Logger';
import { testConnection } from '@config/database';
import { redisManager } from '@config/redis.config';
import { scheduler } from '@/jobs';
// import { queueManager } from './jobs/queue.manager';

(async function main(): Promise<void> {
  try {
    // Connect to database
    await testConnection();
    Logger.info('✅ MySQL Database connected');

    // Connect to Redis (Optional - app will work without it)
    const redisEnabled = process.env.ENABLE_REDIS !== 'false';
    if (redisEnabled) {
      try {
        await redisManager.connect();
        Logger.info('✅ Redis connected');
      } catch (error) {
        Logger.warn('⚠️ Redis connection failed, continuing without cache');
        Logger.debug('Redis error:', error);
      }
    } else {
      Logger.info('⏭️ Redis disabled via environment variable');
    }

    // Initialize queue system (BullMQ) - Optional
    // const queueEnabled = process.env.ENABLE_QUEUE !== 'false' && redisManager.isReady();
    // if (queueEnabled) {
    //   try {
    //     await queueManager.initialize();
    //     Logger.info('✅ Queue system initialized');
    //   } catch (error) {
    //     Logger.warn('⚠️ Queue system initialization failed, continuing without queue');
    //     Logger.debug('Queue error:', error);
    //   }
    // } else {
    //   Logger.info('⏭️ Queue system disabled (Redis not available or disabled)');
    // }

    // Initialize cron scheduler - Optional
    const cronEnabled = process.env.ENABLE_CRON === 'true';
    if (cronEnabled) {
      try {
        scheduler.start();
        Logger.info('✅ Cron scheduler initialized');
      } catch (error) {
        Logger.warn('⚠️ Cron scheduler initialization failed, continuing without scheduler');
        Logger.debug('Cron error:', error);
      }
    } else {
      Logger.info('⏭️ Cron scheduler disabled via environment variable');
    }

    process.on('uncaughtException', (e) => {
      Logger.error('Uncaught exception:', e);
    });

    process.on('unhandledRejection', (reason, promise) => {
      Logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });

    const app: express.Application = new Server().app

    // Simple home page (stops the noisy 404s on GET /)
    app.get('/', (_req, res) => res.status(200).send('OK'));

    // Health check endpoint (point ALB/monitor here)
    app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

    // Quiet the favicon requests (no body, 204)
    app.get('/favicon.ico', (_req, res) => res.status(204).end());
    const server: HttpServer = createServer(app)

    server.listen(port)

    server.on('listening', () => {
      Logger.info(`🚀 Server listening on port ${port} in ${environment} mode`);
      Logger.info(`📊 API docs: http://localhost:${port}/api/v1`);
      Logger.info(`🔍 Search: http://localhost:${port}/api/v1/search`);
      Logger.info(`🏨 Hotels: http://localhost:${port}/api/v1/hotels`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      Logger.info('🛑 Shutting down gracefully...');

      try {
        // Stop cron jobs
        scheduler.stop();
      } catch (err) {
        Logger.debug('Error stopping cron:', err);
      }

      // try {
      //   // Close queue connections
      //   await queueManager.close();
      // } catch (err) {
      //   Logger.debug('Error closing queue:', err);
      // }

    //   try {
    //     // Close Redis
    //     await redisManager.disconnect();
    //   } catch (err) {
    //     Logger.debug('Error disconnecting Redis:', err);
    //   }

    //   try {
    //     // Close database pool
    //     const pool = require('./database').default;
    //     await pool.end();
    //     Logger.info('Database connection pool closed');
    //   } catch (err) {
    //     Logger.debug('Error closing database pool:', err);
    //   }

      server.close(() => {
        Logger.info('✅ Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err: any) {
    console.log(err);
    Logger.error(err.stack);
    process.exit(1);
  }
})();
