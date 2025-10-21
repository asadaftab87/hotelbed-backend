import logger from '@utils/logger';

class Logger {
  static info(message: string, ...meta: any[]) {
    logger.info(message, ...meta);
  }

  static error(message: string, ...meta: any[]) {
    logger.error(message, ...meta);
  }

  static warn(message: string, ...meta: any[]) {
    logger.warn(message, ...meta);
  }

  static debug(message: string, ...meta: any[]) {
    logger.debug(message, ...meta);
  }

  static http(message: string, ...meta: any[]) {
    logger.http(message, ...meta);
  }
}

export default Logger;

