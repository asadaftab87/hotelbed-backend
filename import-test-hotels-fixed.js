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

const TEST_HOTELS = [14126, 87607, 96763, 371129];
const CSV_DIR = path.join(__dirname, 'downloads', 'csv_output');

async function importTestHotels(connection) {
  console.log('📥 Importing test hotel data...\n');
  
  // Disable foreign key checks
  await connection.query('SET FOREIGN_KEY_CHECKS=0');
  
  // Import inventory
  const invFile = path.join(CSV_DIR, 'hotel_inventory.csv');
  const invStream = fs.createReadStream(invFile);
  const invRl = readline.createInterface({ input: invStream });
  
  let invBatch = [];
  let invCount = 0;
  let isFirstLine = true;
  
  for await (const line of invRl) {
    if (isFirstLine) { isFirstLine = false; continue; }
    
    const hotelId = parseInt(line.split(',')[0]);
    if (TEST_HOTELS.includes(hotelId)) {
      const parts = line.split(',');
      invBatch.push([
        hotelId,
        parts[1] || null,
        parts[2] || null,
        parts[3] || null,
        parts[4] || null,
        parts[5] || null
      ]);
      
      if (invBatch.length >= 500) {
        const placeholders = invBatch.map(() => '(?,?,?,?,?,?)').join(',');
        await connection.query(
          `INSERT IGNORE INTO hotel_inventory (hotel_id,room_code,board_code,date_from,date_to,availability_data) VALUES ${placeholders}`,
          invBatch.flat()
        );
        invCount += invBatch.length;
        invBatch = [];
      }
    }
  }
  
  if (invBatch.length > 0) {
    const placeholders = invBatch.map(() => '(?,?,?,?,?,?)').join(',');
    await connection.query(
      `INSERT IGNORE INTO hotel_inventory (hotel_id,room_code,board_code,date_from,date_to,availability_data) VALUES ${placeholders}`,
      invBatch.flat()
    );
    invCount += invBatch.length;
  }
  
  console.log(`✓ Inventory: ${invCount} records`);
  
  // Import rates
  const rateFile = path.join(CSV_DIR, 'hotel_rates.csv');
  const rateStream = fs.createReadStream(rateFile);
  const rateRl = readline.createInterface({ input: rateStream });
  
  let rateBatch = [];
  let rateCount = 0;
  isFirstLine = true;
  
  for await (const line of rateRl) {
    if (isFirstLine) { isFirstLine = false; continue; }
    
    const hotelId = parseInt(line.split(',')[0]);
    if (TEST_HOTELS.includes(hotelId)) {
      const parts = line.split(',');
      rateBatch.push([
        hotelId,
        parts[1] || null,
        parts[2] || null,
        parts[3] || null,
        parts[4] || null,
        parts[5] || 'N',
        parseFloat(parts[6]) || 0,
        parseFloat(parts[7]) || 0,
        parseInt(parts[8]) || 0,
        parts[9] || null,
        parseFloat(parts[10]) || 0
      ]);
      
      if (rateBatch.length >= 500) {
        const placeholders = rateBatch.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',');
        await connection.query(
          `INSERT IGNORE INTO hotel_rates (hotel_id,room_code,board_code,date_from,date_to,rate_type,base_price,tax_amount,adults,board_type,price) VALUES ${placeholders}`,
          rateBatch.flat()
        );
        rateCount += rateBatch.length;
        process.stdout.write(`\r   Rates: ${rateCount.toLocaleString()}...`);
        rateBatch = [];
      }
    }
  }
  
  if (rateBatch.length > 0) {
    const placeholders = rateBatch.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',');
    await connection.query(
      `INSERT IGNORE INTO hotel_rates (hotel_id,room_code,board_code,date_from,date_to,rate_type,base_price,tax_amount,adults,board_type,price) VALUES ${placeholders}`,
      rateBatch.flat()
    );
    rateCount += rateBatch.length;
  }
  
  console.log(`\n✓ Rates: ${rateCount} records\n`);
  
  // Re-enable foreign key checks
  await connection.query('SET FOREIGN_KEY_CHECKS=1');
}

async function showPricing(connection) {
  const [hotels] = await connection.query(`
    SELECT id, name FROM hotels WHERE id IN (14126, 87607, 96763, 371129)
  `);
  
  for (const hotel of hotels) {
    console.log(`\n🏨 ${hotel.name} (${hotel.id})`);
    
    const [rates] = await connection.query(
      'SELECT COUNT(*) as count FROM hotel_rates WHERE hotel_id = ?',
      [hotel.id]
    );
    
    console.log(`   Total rates: ${rates[0].count.toLocaleString()}`);
    
    if (rates[0].count > 0) {
      const [samples] = await connection.query(`
        SELECT room_code, board_code, adults, price, date_from, date_to
        FROM hotel_rates 
        WHERE hotel_id = ? 
        ORDER BY price DESC
        LIMIT 5
      `, [hotel.id]);
      
      console.log('   Top rates:');
      samples.forEach(r => {
        console.log(`      ${r.room_code}/${r.board_code} | ${r.adults}p | €${r.price} | ${r.date_from} to ${r.date_to}`);
      });
    }
  }
}

async function main() {
  console.log('🚀 Import Test Hotels\n');
  
  const connection = await mysql.createConnection(DB_CONFIG);
  
  await importTestHotels(connection);
  await showPricing(connection);
  
  await connection.end();
  console.log('\n✅ Done!');
}

main().catch(console.error);
