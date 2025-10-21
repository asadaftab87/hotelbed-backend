import { Request, Response } from 'express';
import os from 'os';
import pool from '@config/database';
import redisClient from '@config/redis';
import logger from '@utils/logger';

export class MonitoringController {
  // Health check endpoint
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        success: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        service: 'Hotel Bed Backend API',
        version: '1.0.0',
      };

      res.status(200).json(health);
    } catch (error: any) {
      logger.error('Health check failed', error);
      res.status(503).json({
        success: false,
        message: 'Service unavailable',
        error: error.message,
      });
    }
  }

  // Detailed health check with dependencies
  async detailedHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const checks = {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
      };

      const allHealthy = Object.values(checks).every((check: any) => check.healthy);

      const response = {
        success: allHealthy,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        service: 'Hotel Bed Backend API',
        version: '1.0.0',
        checks,
      };

      res.status(allHealthy ? 200 : 503).json(response);
    } catch (error: any) {
      logger.error('Detailed health check failed', error);
      res.status(503).json({
        success: false,
        message: 'Service unavailable',
        error: error.message,
      });
    }
  }

  // System metrics endpoint
  async systemMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = {
        success: true,
        timestamp: new Date().toISOString(),
        system: {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          memoryUsage: `${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2)}%`,
          uptime: `${(os.uptime() / 3600).toFixed(2)} hours`,
          loadAverage: os.loadavg(),
        },
        process: {
          nodeVersion: process.version,
          pid: process.pid,
          uptime: `${(process.uptime() / 3600).toFixed(2)} hours`,
          memoryUsage: {
            rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
            external: `${(process.memoryUsage().external / 1024 / 1024).toFixed(2)} MB`,
          },
          cpuUsage: process.cpuUsage(),
        },
      };

      res.status(200).json(metrics);
    } catch (error: any) {
      logger.error('System metrics error', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve system metrics',
        error: error.message,
      });
    }
  }

  // Application statistics
  async appStats(req: Request, res: Response): Promise<void> {
    try {
      const [usersResult] = await pool.execute('SELECT COUNT(*) as count FROM users');
      const [roomsResult] = await pool.execute('SELECT COUNT(*) as count FROM rooms');
      const [bookingsResult] = await pool.execute('SELECT COUNT(*) as count FROM bookings');
      const [activeBookingsResult] = await pool.execute(
        "SELECT COUNT(*) as count FROM bookings WHERE status IN ('pending', 'confirmed')"
      );

      const stats = {
        success: true,
        timestamp: new Date().toISOString(),
        statistics: {
          users: {
            total: (usersResult as any[])[0].count,
          },
          rooms: {
            total: (roomsResult as any[])[0].count,
          },
          bookings: {
            total: (bookingsResult as any[])[0].count,
            active: (activeBookingsResult as any[])[0].count,
          },
        },
      };

      res.status(200).json(stats);
    } catch (error: any) {
      logger.error('App stats error', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve application statistics',
        error: error.message,
      });
    }
  }

  // Private helper methods
  private async checkDatabase(): Promise<any> {
    try {
      const connection = await pool.getConnection();
      connection.release();
      return {
        healthy: true,
        message: 'Database connection successful',
        responseTime: Date.now(),
      };
    } catch (error: any) {
      logger.error('Database health check failed', error);
      return {
        healthy: false,
        message: 'Database connection failed',
        error: error.message,
      };
    }
  }

  private async checkRedis(): Promise<any> {
    try {
      const isConnected = redisClient.isReady();
      
      if (!isConnected) {
        return {
          healthy: false,
          message: 'Redis not connected',
        };
      }

      // Try a simple operation
      await redisClient.set('health_check', 'ok', 10);
      const value = await redisClient.get('health_check');

      return {
        healthy: value === 'ok',
        message: value === 'ok' ? 'Redis connection successful' : 'Redis operation failed',
        responseTime: Date.now(),
      };
    } catch (error: any) {
      logger.error('Redis health check failed', error);
      return {
        healthy: false,
        message: 'Redis connection failed',
        error: error.message,
      };
    }
  }

  // Clear all caches
  async clearCache(req: Request, res: Response): Promise<void> {
    try {
      const success = await redisClient.flushAll();

      if (success) {
        logger.info('All caches cleared');
        res.status(200).json({
          success: true,
          message: 'All caches cleared successfully',
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to clear caches',
        });
      }
    } catch (error: any) {
      logger.error('Clear cache error', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear caches',
        error: error.message,
      });
    }
  }
}

export default new MonitoringController();

