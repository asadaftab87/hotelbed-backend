import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define log format for files (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.uncolorize(),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create logs directory path
const logsDir = path.join(process.cwd(), 'logs');

// Daily rotate file transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
});

// Daily rotate file transport for error logs
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: fileFormat,
});

// Create transports array
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: format,
  }),
  // File transports
  allLogsTransport,
  errorLogsTransport,
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  transports,
  exitOnError: false,
});

// Export logger methods
export default {
  error: (message: string, meta?: any) => {
    if (meta) {
      logger.error(`${message} ${JSON.stringify(meta)}`);
    } else {
      logger.error(message);
    }
  },
  warn: (message: string, meta?: any) => {
    if (meta) {
      logger.warn(`${message} ${JSON.stringify(meta)}`);
    } else {
      logger.warn(message);
    }
  },
  info: (message: string, meta?: any) => {
    if (meta) {
      logger.info(`${message} ${JSON.stringify(meta)}`);
    } else {
      logger.info(message);
    }
  },
  http: (message: string, meta?: any) => {
    if (meta) {
      logger.http(`${message} ${JSON.stringify(meta)}`);
    } else {
      logger.http(message);
    }
  },
  debug: (message: string, meta?: any) => {
    if (meta) {
      logger.debug(`${message} ${JSON.stringify(meta)}`);
    } else {
      logger.debug(message);
    }
  },
};

