/**
 * Run migration to fix inventoryTuples column
 * Changes VARCHAR(191) → TEXT to prevent truncation
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: "hotelbed.c2hokug86b13.us-east-1.rds.amazonaws.com",
  user: "asadaftab",
  password: "Asad12345$",
  database: "hotelbed",
  waitForConnections: true,
  connectionLimit: 5,
});

async function runMigration() {
  try {
    console.log('🔧 Running migration: Fix inventoryTuples column...\n');
    
    // Read migration file
    const sqlFile = path.join(__dirname, 'fix-inventory-tuples-text.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute migration
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 60)}...`);
        await pool.query(statement);
        console.log('✅ Success\n');
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('\n⚠️  IMPORTANT: You must re-import data or rebuild inventory!');
    console.log('   Run: GET /hotelbed?mode=full');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

