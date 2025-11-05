// Quick script to update cheapest_pp with real hotel names from hotels table
const mysql = require('mysql2/promise');

async function updateCheapestPPNames() {
  const connection = await mysql.createConnection({
    host: 'hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com',
    user: 'hotelbed',
    password: 'Aurora123!Secure',
    database: 'hotelbed_db'
  });

  try {
    console.log('🔄 Updating cheapest_pp with hotel details from hotels table...');
    
    const [result] = await connection.query(`
      UPDATE cheapest_pp cp
      INNER JOIN hotels h ON cp.hotel_id = h.id
      SET 
        cp.hotel_name = h.name,
        cp.destination_code = h.destination_code,
        cp.country_code = h.country_code,
        cp.hotel_category = h.category,
        cp.latitude = h.latitude,
        cp.longitude = h.longitude
    `);
    
    console.log(`✅ Updated ${result.affectedRows} rows in cheapest_pp`);
    
    // Show sample
    const [sample] = await connection.query(`
      SELECT hotel_id, hotel_name, destination_code, price_pp 
      FROM cheapest_pp 
      WHERE hotel_id IN (1, 2, 5, 23496)
      LIMIT 10
    `);
    
    console.log('\n📊 Sample data:');
    console.table(sample);
    
  } finally {
    await connection.end();
  }
}

updateCheapestPPNames().catch(console.error);
