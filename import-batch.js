#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_CONFIG = {
  host: 'hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'hotelbed',
  password: 'Aurora123!Secure',
  database: 'hotelbed_db'
};

const CSV_DIR = path.join(__dirname, 'downloads', 'csv_output');

async function importBatch(connection, table, csvFile, batchSize = 10000) {
  const filePath = path.join(CSV_DIR, csvFile);
  
  console.log(`\n📥 Importing ${table}...`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  let headers = null;
  let batch = [];
  let total = 0;
  const start = Date.now();
  
  for await (const line of rl) {
    if (!headers) {
      headers = line.split(',').map(h => h.replace(/"/g, ''));
      continue;
    }
    
    const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g).map(v => 
      v.trim().replace(/^"|"$/g, '').replace(/""/g, '"')
    );
    
    batch.push(values);
    
    if (batch.length >= batchSize) {
      const placeholders = batch.map(() => `(${headers.map(() => '?').join(',')})`).join(',');
      const sql = `INSERT INTO ${table} (${headers.join(',')}) VALUES ${placeholders}`;
      const flatValues = batch.flat();
      
      await connection.query(sql, flatValues);
      
      total += batch.length;
      process.stdout.write(`\r   ${total.toLocaleString()} records...`);
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    const placeholders = batch.map(() => `(${headers.map(() => '?').join(',')})`).join(',');
    const sql = `INSERT INTO ${table} (${headers.join(',')}) VALUES ${placeholders}`;
    await connection.query(sql, batch.flat());
    total += batch.length;
  }
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n   ✓ ${total.toLocaleString()} records in ${elapsed}s`);
}

async function checkHotels(connection) {
  console.log('\n🔍 Test hotels:\n');
  
  const [hotels] = await connection.query(`
    SELECT h.id, h.name,
      (SELECT COUNT(*) FROM hotel_rates WHERE hotel_id = h.id) as rate_count
    FROM hotels h
    WHERE h.id IN (14126, 87607, 96763, 371129)
  `);
  
  for (const hotel of hotels) {
    console.log(`${hotel.name} (${hotel.id}): ${hotel.rate_count} rates`);
    
    if (hotel.rate_count > 0) {
      const [sample] = await connection.query(
        'SELECT room_code, board_code, adults, price FROM hotel_rates WHERE hotel_id = ? LIMIT 2',
        [hotel.id]
      );
      sample.forEach(r => console.log(`   ${r.room_code}/${r.board_code}: €${r.price} (${r.adults}p)`));
    }
  }
}

async function main() {
  console.log('🚀 Batch Import\n');
  
  const connection = await mysql.createConnection(DB_CONFIG);
  console.log('✓ Connected\n');
  
  await importBatch(connection, 'hotel_inventory', 'hotel_inventory.csv', 5000);
  await importBatch(connection, 'hotel_rates', 'hotel_rates.csv', 5000);
  
  await checkHotels(connection);
  
  await connection.end();
  console.log('\n✅ Done!');
}

main().catch(console.error);
