const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: "107.21.156.43",
  user: "asadaftab",
  password: "Asad124@",
  database: "hotelbed",
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true
});

async function runMigration() {
  const conn = await pool.getConnection();
  
  try {
    console.log('🔧 Running migration...');
    
    // Drop table and recreate with all fields
    await conn.query('DROP TABLE IF EXISTS `Inventory`');
    console.log('✅ Dropped old Inventory table');
    
    // Create new Inventory table with all fields
    await conn.query(`
      CREATE TABLE \`Inventory\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`hotelBedId\` VARCHAR(191) NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`contractId\` VARCHAR(191) NULL,
        \`hotelCode\` VARCHAR(191) NULL,
        \`roomCode\` VARCHAR(191) NULL,
        \`characteristic\` VARCHAR(191) NULL,
        \`rateCode\` VARCHAR(191) NULL,
        \`boardCode\` VARCHAR(191) NULL,
        \`startDate\` DATETIME(3) NULL,
        \`endDate\` DATETIME(3) NULL,
        \`calendarDate\` DATETIME(3) NULL,
        \`allotment\` INT NULL,
        \`stopSale\` BOOLEAN NULL,
        \`releaseDays\` INT NULL,
        \`cta\` INT NULL,
        \`ctd\` INT NULL,
        \`minNights\` INT NULL,
        \`maxNights\` INT NULL,
        \`netPrice\` DOUBLE NULL,
        \`publicPrice\` DOUBLE NULL,
        \`marketPrice\` DOUBLE NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`Inventory_hotelBedId_fkey\`(\`hotelBedId\`),
        INDEX \`Inventory_contractId_idx\`(\`contractId\`),
        INDEX \`Inventory_hotelCode_idx\`(\`hotelCode\`),
        INDEX \`Inventory_roomCode_characteristic_idx\`(\`roomCode\`, \`characteristic\`),
        INDEX \`Inventory_calendarDate_hotelCode_idx\`(\`calendarDate\`, \`hotelCode\`),
        INDEX \`Inventory_hotelCode_roomCode_calendarDate_idx\`(\`hotelCode\`, \`roomCode\`, \`calendarDate\`),
        INDEX \`Inventory_startDate_endDate_idx\`(\`startDate\`, \`endDate\`),
        INDEX \`Inventory_rateCode_idx\`(\`rateCode\`),
        CONSTRAINT \`Inventory_hotelBedId_fkey\` 
          FOREIGN KEY (\`hotelBedId\`) 
          REFERENCES \`HotelBedFile\`(\`id\`) 
          ON DELETE RESTRICT 
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    console.log('✅ Created new Inventory table with all fields and indexes');
    
    // Verify table structure
    const [columns] = await conn.query('SHOW COLUMNS FROM Inventory');
    console.log('\n📋 Inventory table columns:');
    columns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type})`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Error:', err);
    process.exit(1);
  });

