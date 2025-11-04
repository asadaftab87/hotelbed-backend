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
  
  let updated = 0;
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 11) {
      const id = parts[0];
      const name = parts.slice(10).join(':').trim();
      if (name) {
        await conn.query('UPDATE hotels SET name = ? WHERE id = ?', [name, id]);
        updated++;
      }
    }
  }

  console.log(`Updated ${updated} hotel names from GHOT_F`);
  
  // Now recompute cheapest_pp with real names
  await conn.query('DELETE FROM cheapest_pp');
  await conn.query(`
    INSERT INTO cheapest_pp 
    (hotel_id, hotel_name, destination_code, country_code, hotel_category, latitude, longitude, 
     category_tag, start_date, end_date, nights, board_code, room_code, price_pp, total_price, currency, has_promotion)
    SELECT 
      r.hotel_id,
      h.name as hotel_name,
      h.destination_code,
      h.country_code,
      h.category as hotel_category,
      h.latitude,
      h.longitude,
      'CITY_TRIP' as category_tag,
      MIN(r.date_from) as start_date,
      DATE_ADD(MIN(r.date_from), INTERVAL 2 DAY) as end_date,
      2 as nights,
      'RO' as board_code,
      'STD' as room_code,
      ROUND(MIN(r.price) * 2 / 2, 2) as price_pp,
      ROUND(MIN(r.price) * 2, 2) as total_price,
      'EUR' as currency,
      0 as has_promotion
    FROM hotel_rates r
    JOIN hotels h ON r.hotel_id = h.id
    WHERE r.price > 0
    GROUP BY r.hotel_id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude
  `);
  
  const [result] = await conn.query('SELECT COUNT(*) as cnt FROM cheapest_pp WHERE hotel_name NOT LIKE "Property%"');
  console.log(`Cheapest prices with real names: ${result[0].cnt}`);
  
  await conn.end();
})();
