import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from '@utils/logger';
import fs from 'fs';

dotenv.config();

// MySQL connection pool configuration - ✅ OPTIMIZED FOR AURORA + LOCAL INFILE
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hotelbed_db',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20'),
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  infileStreamFactory: (filePath: string) => fs.createReadStream(filePath),
});

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    logger.info('✅ MySQL Database connected successfully!');
    connection.release();
  } catch (error) {
    logger.error('❌ MySQL Database connection failed:', error);
    throw error;
  }
};

export default pool;

