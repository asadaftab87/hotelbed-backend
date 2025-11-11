#!/usr/bin/env node

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'hotelbed',
  password: 'Aurora123!Secure',
  database: 'hotelbed_db'
};

async function main() {
  const connection = await mysql.createConnection(DB_CONFIG);
  
  console.log('🔍 Checking hotel pricing...\n');
  
  const [counts] = await connection.query(`
    SELECT 
      (SELECT COUNT(*) FROM hotel_inventory) as inv_count,
      (SELECT COUNT(*) FROM hotel_rates) as rate_count
  `);
  
  console.log(`📊 Total records:`);
  console.log(`   Inventory: ${counts[0].inv_count.toLocaleString()}`);
  console.log(`   Rates: ${counts[0].rate_count.toLocaleString()}\n`);
  
  const testHotels = [
    { id: 14126, name: 'Rixos Premium Belek' },
    { id: 87607, name: 'Royal Dragon Hotel' },
    { id: 96763, name: 'Long Beach Resort' },
    { id: 371129, name: 'Alan Xafira Deluxe Resort' }
  ];
  
  for (const hotel of testHotels) {
    console.log(`\n🏨 ${hotel.name} (ID: ${hotel.id})`);
    
    const [inv] = await connection.query(
      'SELECT COUNT(*) as count FROM hotel_inventory WHERE hotel_id = ?',
      [hotel.id]
    );
    
    const [rates] = await connection.query(
      'SELECT COUNT(*) as count FROM hotel_rates WHERE hotel_id = ?',
      [hotel.id]
    );
    
    console.log(`   Inventory records: ${inv[0].count}`);
    console.log(`   Rate records: ${rates[0].count}`);
    
    if (rates[0].count > 0) {
      const [samples] = await connection.query(`
        SELECT room_code, board_code, date_from, date_to, adults, price 
        FROM hotel_rates 
        WHERE hotel_id = ? 
        ORDER BY price DESC
        LIMIT 3
      `, [hotel.id]);
      
      console.log(`   Sample rates:`);
      samples.forEach(r => {
        console.log(`      ${r.room_code} | ${r.board_code} | ${r.adults}p | €${r.price} | ${r.date_from} to ${r.date_to}`);
      });
    } else {
      console.log(`   ⚠️  NO PRICING DATA FOUND`);
    }
  }
  
  await connection.end();
  console.log('\n✅ Check complete!');
}

main().catch(console.error);
