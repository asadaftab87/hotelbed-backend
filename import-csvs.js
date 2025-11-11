#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: 'hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'hotelbed',
  password: 'Aurora123!Secure',
  database: 'hotelbed_db',
  multipleStatements: true
};

const CSV_DIR = path.join(__dirname, 'downloads', 'csv_output');

async function importCSV(connection, table, csvFile) {
  const filePath = path.join(CSV_DIR, csvFile);
  
  console.log(`\n📥 Importing ${table}...`);
  
  const sql = `
    LOAD DATA LOCAL INFILE '${filePath}'
    INTO TABLE ${table}
    FIELDS TERMINATED BY ',' 
    ENCLOSED BY '"'
    LINES TERMINATED BY '\\n'
    IGNORE 1 ROWS;
  `;
  
  const start = Date.now();
  await connection.query({
    sql: sql,
    infileStreamFactory: () => fs.createReadStream(filePath)
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
  console.log(`   ✓ ${rows[0].count.toLocaleString()} records in ${elapsed}s`);
}

async function main() {
  console.log('🚀 CSV Import to Aurora\n');
  
  const connection = await mysql.createConnection({
    ...DB_CONFIG,
    infileStreamFactory: path => fs.createReadStream(path)
  });
  
  console.log('✓ Connected to Aurora');
  
  await importCSV(connection, 'hotel_inventory', 'hotel_inventory.csv');
  await importCSV(connection, 'hotel_rates', 'hotel_rates.csv');
  
  console.log('\n🔍 Checking test hotels...\n');
  
  const [hotels] = await connection.query(`
    SELECT id, name FROM hotels 
    WHERE id IN (14126, 87607, 96763, 371129)
  `);
  
  for (const hotel of hotels) {
    const [inv] = await connection.query(
      'SELECT COUNT(*) as count FROM hotel_inventory WHERE hotel_id = ?',
      [hotel.id]
    );
    const [rates] = await connection.query(
      'SELECT COUNT(*) as count FROM hotel_rates WHERE hotel_id = ?',
      [hotel.id]
    );
    
    console.log(`${hotel.name} (${hotel.id}):`);
    console.log(`   Inventory: ${inv[0].count} | Rates: ${rates[0].count}`);
  }
  
  await connection.end();
  console.log('\n✅ Done!');
}

main().catch(console.error);
