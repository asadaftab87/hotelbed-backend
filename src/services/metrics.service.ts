import { Request, Response, NextFunction } from 'express';
import os from 'os';

class MetricsService {
  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  getMetricsHandler() {
    return (req: Request, res: Response) => {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        uptime: `${uptime}s`,
        requests: {
          total: this.requestCount,
          errors: this.errorCount,
        },
        system: {
          platform: os.platform(),
          cpus: os.cpus().length,
          memory: {
            total: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
            free: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          },
          uptime: `${(os.uptime() / 3600).toFixed(2)} hours`,
        },
        process: {
          pid: process.pid,
          uptime: `${(process.uptime() / 3600).toFixed(2)} hours`,
          memory: {
            heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
          },
        },
      });
    };
  }

  trackHttpRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.requestCount++;
      
      res.on('finish', () => {
        if (res.statusCode >= 400) {
          this.errorCount++;
        }
      });
      
      next();
    };
  }

  reset() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }
}

export const metricsService = new MetricsService();

