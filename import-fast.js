#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DB_CONFIG = {
  host: 'hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'hotelbed',
  password: 'Aurora123!Secure',
  database: 'hotelbed_db'
};

const CSV_DIR = path.join(__dirname, 'downloads', 'csv_output');

async function importWithMysqlCLI(table, csvFile) {
  const filePath = path.join(CSV_DIR, csvFile);
  
  console.log(`\n📥 Importing ${table}...`);
  
  const sql = `
    SET FOREIGN_KEY_CHECKS=0;
    LOAD DATA LOCAL INFILE '${filePath}'
    INTO TABLE ${table}
    FIELDS TERMINATED BY ',' 
    ENCLOSED BY '"'
    LINES TERMINATED BY '\\n'
    IGNORE 1 ROWS;
    SET FOREIGN_KEY_CHECKS=1;
  `;
  
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    const mysql_proc = spawn('mysql', [
      `-h${DB_CONFIG.host}`,
      `-P${DB_CONFIG.port}`,
      `-u${DB_CONFIG.user}`,
      `-p${DB_CONFIG.password}`,
      '--local-infile=1',
      DB_CONFIG.database,
      '-e',
      sql
    ]);
    
    let stderr = '';
    
    mysql_proc.stderr.on('data', (data) => {
      stderr += data.toString();
      if (data.toString().includes('Records:')) {
        process.stdout.write(`\r   ${data.toString().trim()}`);
      }
    });
    
    mysql_proc.on('close', (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`\n   ✓ Done in ${elapsed}s`);
        resolve();
      } else {
        reject(new Error(stderr));
      }
    });
  });
}

async function checkRecords() {
  const connection = await mysql.createConnection(DB_CONFIG);
  
  console.log('\n📊 Record counts:');
  
  const [inv] = await connection.query('SELECT COUNT(*) as count FROM hotel_inventory');
  console.log(`   hotel_inventory: ${inv[0].count.toLocaleString()}`);
  
  const [rates] = await connection.query('SELECT COUNT(*) as count FROM hotel_rates');
  console.log(`   hotel_rates: ${rates[0].count.toLocaleString()}`);
  
  console.log('\n🔍 Test hotels:');
  
  const [hotels] = await connection.query(`
    SELECT h.id, h.name,
      (SELECT COUNT(*) FROM hotel_inventory WHERE hotel_id = h.id) as inv_count,
      (SELECT COUNT(*) FROM hotel_rates WHERE hotel_id = h.id) as rate_count
    FROM hotels h
    WHERE h.id IN (14126, 87607, 96763, 371129)
  `);
  
  for (const hotel of hotels) {
    console.log(`\n${hotel.name} (${hotel.id}):`);
    console.log(`   Inventory: ${hotel.inv_count}`);
    console.log(`   Rates: ${hotel.rate_count}`);
    
    if (hotel.rate_count > 0) {
      const [sample] = await connection.query(
        'SELECT room_code, board_code, date_from, date_to, adults, price FROM hotel_rates WHERE hotel_id = ? LIMIT 3',
        [hotel.id]
      );
      console.log('   Sample rates:');
      sample.forEach(r => {
        console.log(`      ${r.room_code}/${r.board_code}: ${r.price} EUR (${r.adults} adults, ${r.date_from} to ${r.date_to})`);
      });
    }
  }
  
  await connection.end();
}

async function main() {
  console.log('🚀 Fast CSV Import\n');
  
  try {
    await importWithMysqlCLI('hotel_inventory', 'hotel_inventory.csv');
    await importWithMysqlCLI('hotel_rates', 'hotel_rates.csv');
    
    await checkRecords();
    
    console.log('\n✅ Import complete!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
