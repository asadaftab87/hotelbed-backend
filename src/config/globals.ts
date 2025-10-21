import dotenv from 'dotenv';
dotenv.config();

export const env = {
  // App Settings
  APP_NAME: process.env.APP_NAME || 'HotelBed-Backend',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000'),
  API_VERSION: process.env.API_VERSION || 'v1',
  API_PREFIX: process.env.API_PREFIX || '/api',
  DOMAIN: process.env.DOMAIN || 'localhost',
  LOG_DIRECTORY: process.env.LOG_DIRECTORY || 'logs',
  
  // Database
  DB_URI: process.env.DB_URI || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306'),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'hotelbed',
  DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  
  // Redis
  ENABLE_REDIS: process.env.ENABLE_REDIS === 'true',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_DB: parseInt(process.env.REDIS_DB || '0'),
  ENABLE_PROMETHEUS: process.env.ENABLE_PROMETHEUS === 'true',
  
  // Redis TTL Settings
  REDIS_TTL_SEARCH: parseInt(process.env.REDIS_TTL_SEARCH || '1800'),
  REDIS_TTL_MATRIX: parseInt(process.env.REDIS_TTL_MATRIX || '900'),
  REDIS_TTL_STATIC: parseInt(process.env.REDIS_TTL_STATIC || '86400'),
  REDIS_TTL_CHEAPEST: parseInt(process.env.REDIS_TTL_CHEAPEST || '3600'),
  REDIS_KEY_VERSION: process.env.REDIS_KEY_VERSION || 'v1',
  
  // Queue & Cron
  ENABLE_QUEUE: process.env.ENABLE_QUEUE === 'true',
  ENABLE_CRON: process.env.ENABLE_CRON === 'true',
  SYNC_INTERVAL_MIN: parseInt(process.env.SYNC_INTERVAL_MIN || '60'),
  
  // HotelBeds API
  HOTELBEDS_API_KEY: process.env.HOTELBEDS_API_KEY || '',
  HOTELBEDS_BASE_URL: process.env.HOTELBEDS_BASE_URL || 'https://aif2.hotelbeds.com/aif2-pub-ws/files',
  HOTELBEDS_CACHE_ENDPOINT: process.env.HOTELBEDS_CACHE_ENDPOINT || '/cache/HotelbedsStaticData.zip',
  HOTELBEDS_CACHE_TYPE: process.env.HOTELBEDS_CACHE_TYPE || 'static_data',
  
  // Precompute Settings
  PRECOMPUTE_INTERVAL_MIN: parseInt(process.env.PRECOMPUTE_INTERVAL_MIN || '60'),
  PRECOMPUTE_HORIZON_DAYS: parseInt(process.env.PRECOMPUTE_HORIZON_DAYS || '365'),
  PRECOMPUTE_CITY_MIN_NIGHTS: parseInt(process.env.PRECOMPUTE_CITY_MIN_NIGHTS || '2'),
  PRECOMPUTE_OTHER_MIN_NIGHTS: parseInt(process.env.PRECOMPUTE_OTHER_MIN_NIGHTS || '5'),
  PRECOMPUTE_CONCURRENCY: parseInt(process.env.PRECOMPUTE_CONCURRENCY || '10'),
};

export const port = env.PORT;
export const environment = env.NODE_ENV;

