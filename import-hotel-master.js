const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importHotelMaster() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('✅ Connected to database\n');

  const filePath = path.join(__dirname, 'downloads/hotelbed_cache_full_1762202520003/GENERAL/GHOT_F');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l && !l.startsWith('{'));

  console.log(`📥 Processing ${lines.length} hotels...\n`);

  let updated = 0;
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length < 12) continue;

    const hotelId = parseInt(parts[0]);
    const category = parts[1];
    const destinationCode = parts[2];
    const chainCode = parts[3] || null;
    const countryCode = parts[6];
    const stateCode = parts[7] || null;
    const longitude = parseFloat(parts[9]) || 0;
    const latitude = parseFloat(parts[10]) || 0;
    const name = parts[11] || `Property ${hotelId}`;

    try {
      await connection.query(`
        UPDATE hotels 
        SET name = ?, category = ?, destination_code = ?, chain_code = ?, 
            country_code = ?, state_code = ?, longitude = ?, latitude = ?
        WHERE id = ?
      `, [name, category, destinationCode, chainCode, countryCode, stateCode, longitude, latitude, hotelId]);
      updated++;
    } catch (err) {
      // Skip errors
    }
  }

  console.log(`✅ Updated ${updated} hotels\n`);
  await connection.end();
}

importHotelMaster();
