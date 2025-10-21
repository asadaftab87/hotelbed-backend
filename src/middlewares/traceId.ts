import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const addTraceId = (req: Request, res: Response, next: NextFunction): void => {
  // Generate or use existing trace ID
  const traceId = req.headers['x-trace-id'] as string || uuidv4();
  
  // Add to request
  (req as any).traceId = traceId;
  
  // Add to response headers
  res.setHeader('X-Trace-Id', traceId);
  
  next();
};

