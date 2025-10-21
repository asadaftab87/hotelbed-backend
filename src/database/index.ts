import pool from '@config/database';
import { testConnection } from '@config/database';

// Export MySQL pool and test connection
export { pool, testConnection };

export default pool;

