
const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * This script calculates the cheapest per-person price for each hotel,
 * including taxes, and populates the `cheapest_pp` table.
 * 
 * It improves upon the original logic by joining with the `hotel_tax_info`
 * table to create a more accurate final price.
 */
async function computeCheapestPrices() {
  console.log('🚀 Starting cheapest price calculation...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('✅ Connected to database.');

  try {
    // Step 1: Truncate the table to ensure a clean slate.
    console.log('🗑️  Clearing the cheapest_pp table...');
    await connection.query('TRUNCATE TABLE cheapest_pp');
    console.log('   ✅ Table cleared.');

    // Step 2: Run the main query to compute and insert the cheapest prices.
    // This query joins rates with hotels (for names) and taxes (for price adjustments).
    console.log('🧠 Computing and inserting cheapest prices...');
    const query = `
      INSERT INTO cheapest_pp 
        (hotel_id, hotel_name, destination_code, country_code, hotel_category, latitude, longitude,
        category_tag, start_date, end_date, nights, board_code, room_code, 
        price_pp, total_price, currency, has_promotion, derived_at)
      SELECT
        h.id,
        h.name AS hotel_name,
        h.destination_code,
        h.country_code,
        h.category AS hotel_category,
        h.latitude,
        h.longitude,
        'CITY_TRIP' AS category_tag, -- Simplified for this query
        MIN(r.date_from) AS start_date,
        DATE_ADD(MIN(r.date_from), INTERVAL 2 DAY) AS end_date,
        2 AS nights,
        r.board_code,
        r.room_code,
        -- Calculate final price including tax, then divide by 2 for per-person rate
        ROUND(
          (
            MIN(r.price) + 
            COALESCE(t.amount, 0) + 
            (MIN(r.price) * COALESCE(t.percentage, 0) / 100)
          ) / 2, 
        2) AS price_pp,
        -- Calculate final total price for 2 people
        ROUND(
          MIN(r.price) + 
          COALESCE(t.amount, 0) + 
          (MIN(r.price) * COALESCE(t.percentage, 0) / 100),
        2) AS total_price,
        r.currency,
        0 AS has_promotion,
        NOW() AS derived_at
      FROM 
        hotel_rates r
      JOIN 
        hotels h ON r.hotel_id = h.id
      LEFT JOIN 
        hotel_tax_info t ON r.hotel_id = t.hotel_id 
        AND r.date_from >= t.date_from 
        AND r.date_to <= t.date_to
        AND (t.room_code IS NULL OR t.room_code = r.room_code)
        AND (t.board_code IS NULL OR t.board_code = r.board_code)
      WHERE 
        r.price > 0
      GROUP BY 
        h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude, r.board_code, r.room_code, r.currency, t.amount, t.percentage
      ORDER BY
        total_price ASC;
    `;

    const [result] = await connection.query(query);
    console.log(`   ✅ Calculation complete. ${result.affectedRows} records inserted into cheapest_pp.`);

  } catch (error) {
    console.error('❌ An error occurred during the cheapest price calculation:', error);
  } finally {
    await connection.end();
    console.log('🚪 Database connection closed.');
  }
}

// --- Execute the script ---
computeCheapestPrices();
