const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testImport() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    infileStreamFactory: (filePath) => fs.createReadStream(filePath),
  });

  console.log('✅ Connected to database');

  const csvDir = path.join(__dirname, 'downloads', 'csv_output');
  const csvFile = path.join(csvDir, 'hotel_contracts.csv');

  if (!fs.existsSync(csvFile)) {
    console.log('❌ CSV file not found:', csvFile);
    process.exit(1);
  }

  console.log('📁 CSV file found:', csvFile);

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE hotel_contracts');

    const query = `
      LOAD DATA LOCAL INFILE '${csvFile}'
      INTO TABLE hotel_contracts
      FIELDS TERMINATED BY ','
      ENCLOSED BY '"'
      LINES TERMINATED BY '\\n'
      IGNORE 1 ROWS
    `;

    console.log('🚀 Executing LOAD DATA...');
    const [result] = await connection.query(query);
    console.log('✅ Import successful!');
    console.log('   Rows affected:', result.affectedRows);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } catch (error) {
    console.error('❌ Import failed:', error.message);
  } finally {
    await connection.end();
  }
}

testImport();
