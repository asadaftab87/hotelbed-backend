// import winston from "winston/lib/winston/config";
import winston, { format } from "winston";
const { combine, label, json } = format;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
        level: 'error',
        format: combine(
            label({ label: 'Application Error' }),
            json(),
            format.colorize(),
            format.simple()
        )
    }),
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/all.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

export default logger;
