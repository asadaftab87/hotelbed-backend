const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const conn = await mysql.createConnection({
    host: 'hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com',
    user: 'hotelbed',
    password: 'Aurora123!Secure',
    database: 'hotelbed_db'
  });

  const content = fs.readFileSync('downloads/hotelbed_cache_full_1762202520003/GENERAL/GHOT_F', 'utf8');
  const lines = content.split('\n').filter(l => l && !l.startsWith('{'));
  
  console.log(`Processing ${lines.length} hotels from GHOT_F...`);
  
  // Build batch update using CASE WHEN
  const updates = [];
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 11) {
      const id = parts[0];
      const name = parts.slice(10).join(':').trim().replace(/'/g, "''");
      if (name) {
        updates.push(`WHEN ${id} THEN '${name}'`);
      }
    }
  }

  if (updates.length > 0) {
    const sql = `UPDATE hotels SET name = CASE id ${updates.join(' ')} END WHERE id IN (${lines.map(l => l.split(':')[0]).join(',')})`;
    await conn.query(sql);
    console.log(`Updated ${updates.length} hotel names`);
  }

  // Recompute cheapest_pp
  console.log('Recomputing cheapest prices...');
  await conn.query('TRUNCATE cheapest_pp');
  await conn.query(`
    INSERT INTO cheapest_pp 
    (hotel_id, hotel_name, destination_code, country_code, hotel_category, latitude, longitude, 
     category_tag, start_date, end_date, nights, board_code, room_code, price_pp, total_price, currency, has_promotion)
    SELECT 
      r.hotel_id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude,
      'CITY_TRIP', MIN(r.date_from), DATE_ADD(MIN(r.date_from), INTERVAL 2 DAY), 2,
      'RO', 'STD', ROUND(MIN(r.price) * 2 / 2, 2), ROUND(MIN(r.price) * 2, 2), 'EUR', 0
    FROM hotel_rates r
    JOIN hotels h ON r.hotel_id = h.id
    WHERE r.price > 0
    GROUP BY r.hotel_id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude
  `);
  
  const [result] = await conn.query('SELECT COUNT(*) as total, SUM(CASE WHEN hotel_name NOT LIKE "Property%" THEN 1 ELSE 0 END) as real_names FROM cheapest_pp');
  console.log(`Total: ${result[0].total}, Real names: ${result[0].real_names}`);
  
  await conn.end();
})();
