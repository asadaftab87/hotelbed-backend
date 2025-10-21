import { Request, Response, NextFunction, Router } from 'express';
import { ApiError } from '@/core/ApiError';
import Logger from '@/core/Logger';

export default function registerErrorHandler(router: Router): void {
  // Error handling middleware
  router.use((err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
    // Log error
    Logger.error(`Error: ${err.message}`, {
      stack: err.stack,
      url: req.url,
      method: req.method,
    });

    // Handle ApiError
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    }

    // Handle generic errors
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });
}
