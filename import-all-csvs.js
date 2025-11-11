const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importAllCSVs(options = {}) {
  const logger = options.logger || console;
  const csvDir = options.csvDir || path.join(__dirname, 'downloads', 'csv_output');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    infileStreamFactory: (filePath) => fs.createReadStream(filePath),
  });

  logger.log('✅ Connected to database\n');

  const tables = [
    // Core data tables - Must be loaded first
    { name: 'hotels', csv: 'hotels.csv', cols: '(id,category,destination_code,chain_code,accommodation_type,ranking,group_hotel,country_code,state_code,longitude,latitude,name)' },
    { name: 'destinations', csv: 'destinations.csv', cols: '(code,country_code,is_available)' },
    { name: 'categories', csv: 'categories.csv', cols: '(code,simple_code)' },

    // Hotel-specific data tables
    { name: 'hotel_contracts', csv: 'hotel_contracts.csv', cols: '(hotel_id,destination_code,contract_code,rate_code,board_code,contract_type,date_from,date_to,currency,board_type)' },
    { name: 'hotel_room_allocations', csv: 'hotel_room_allocations.csv', cols: '(hotel_id,room_code,board_code,min_adults,max_adults,min_children,max_children,min_pax,max_pax,allocation)' },
    { name: 'hotel_inventory', csv: 'hotel_inventory.csv', cols: '(hotel_id,room_code,board_code,date_from,date_to,availability_data)' },
    { name: 'hotel_rates', csv: 'hotel_rates.csv', cols: '(hotel_id,room_code,board_code,date_from,date_to,rate_type,base_price,tax_amount,adults,board_type,price)' },
    { name: 'hotel_supplements', csv: 'hotel_supplements.csv', cols: '(hotel_id,date_from,date_to,supplement_code,supplement_type,discount_percent,min_nights)' },
    { name: 'hotel_occupancy_rules', csv: 'hotel_occupancy_rules.csv', cols: '(hotel_id,rule_from,rule_to,is_allowed)' },
    { name: 'hotel_email_settings', csv: 'hotel_email_settings.csv', cols: '(hotel_id,date_from,date_to,notification_type,@dummy,room_code,@dummy2)' },
    { name: 'hotel_rate_tags', csv: 'hotel_rate_tags.csv', cols: '(hotel_id,@dummy,tag_name,@dummy2)' },
    { name: 'hotel_configurations', csv: 'hotel_configurations.csv', cols: '(hotel_id,date_from,date_to,criteria_id,@dummy)' },
    { name: 'hotel_groups', csv: 'hotel_groups.csv', cols: '(hotel_id,group_data,@dummy,@dummy2,@dummy3)' },
    { name: 'hotel_special_requests', csv: 'hotel_special_requests.csv', cols: '(hotel_id,request_data,@dummy,@dummy2)' },
    { name: 'hotel_special_conditions', csv: 'hotel_special_conditions.csv', cols: '(hotel_id,condition_code,condition_type,condition_text)' },
    { name: 'hotel_pricing_rules', csv: 'hotel_pricing_rules.csv', cols: '(hotel_id,rule_code,rule_type,date_from,date_to,modifier_value)' },
    { name: 'hotel_tax_info', csv: 'hotel_tax_info.csv', cols: '(hotel_id,date_from,date_to,room_code,board_code,tax_code,included_flag,max_nights,min_age,max_age,per_night,per_pax,amount,percentage,currency,apply_over,market_code,legal_text)' },
  ];

  const tableResults = {};

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('SET UNIQUE_CHECKS = 0');
    await connection.query('SET AUTOCOMMIT = 0');

    for (const table of tables) {
      const csvPath = path.join(csvDir, table.csv);

      if (!fs.existsSync(csvPath)) {
        logger.log(`⏭️  Skipping ${table.name} (no file)`);
        tableResults[table.name] = { skipped: true, reason: 'missing file', rows: 0, duration: '0s' };
        continue;
      }

      const stats = fs.statSync(csvPath);
      if (stats.size === 0) {
        logger.log(`⏭️  Skipping ${table.name} (empty file)`);
        tableResults[table.name] = { skipped: true, reason: 'empty file', rows: 0, duration: '0s' };
        continue;
      }

      logger.log(`📥 Loading ${table.name}...`);
      const start = Date.now();

      const safePath = csvPath.replace(/\\/g, '\\\\');
      const query = `
        LOAD DATA LOCAL INFILE '${safePath}'
        IGNORE
        INTO TABLE ${table.name}
        FIELDS TERMINATED BY ','
        ENCLOSED BY '"'
        LINES TERMINATED BY '\\n'
        IGNORE 1 ROWS
        ${table.cols}
      `;

      try {
        const [result] = await connection.query(query);
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        const rows = result.affectedRows || 0;
        tableResults[table.name] = { success: true, rows, duration: `${duration}s` };
        logger.log(`   ✅ ${rows.toLocaleString()} rows in ${duration}s\n`);
      } catch (tableError) {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        tableResults[table.name] = { success: false, rows: 0, duration: `${duration}s`, error: tableError.message };
        logger.error(`   ❌ Failed to load ${table.name}:`, tableError.message);
        throw tableError;
      }
    }

    await connection.query('COMMIT');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.query('SET UNIQUE_CHECKS = 1');
    await connection.query('SET AUTOCOMMIT = 1');

    logger.log('✅ All imports completed!');
    return { success: true, tables: tableResults };
  } catch (error) {
    logger.error('❌ Import failed:', error.message);
    await connection.query('ROLLBACK');
    return { success: false, tables: tableResults, error: error.message };
  } finally {
    await connection.end();
  }
}

module.exports = { importAllCSVs };

if (require.main === module) {
  importAllCSVs().catch((err) => {
    console.error('Import script terminated with error:', err);
    process.exit(1);
  });
}
