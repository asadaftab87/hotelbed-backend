const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importAllCSVs() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    infileStreamFactory: (filePath) => fs.createReadStream(filePath),
  });

  console.log('✅ Connected to database\n');

  const csvDir = path.join(__dirname, 'downloads', 'csv_output');

  const tables = [
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
  ];

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('SET UNIQUE_CHECKS = 0');
    await connection.query('SET AUTOCOMMIT = 0');

    for (const table of tables) {
      const csvPath = path.join(csvDir, table.csv);
      
      if (!fs.existsSync(csvPath)) {
        console.log(`⏭️  Skipping ${table.name} (no file)`);
        continue;
      }

      const stats = fs.statSync(csvPath);
      if (stats.size === 0) {
        console.log(`⏭️  Skipping ${table.name} (empty file)`);
        continue;
      }

      console.log(`📥 Loading ${table.name}...`);
      const start = Date.now();

      const query = `
        LOAD DATA LOCAL INFILE '${csvPath}'
        IGNORE
        INTO TABLE ${table.name}
        FIELDS TERMINATED BY ','
        ENCLOSED BY '"'
        LINES TERMINATED BY '\\n'
        IGNORE 1 ROWS
        ${table.cols}
      `;

      const [result] = await connection.query(query);
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`   ✅ ${result.affectedRows.toLocaleString()} rows in ${duration}s\n`);
    }

    await connection.query('COMMIT');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.query('SET UNIQUE_CHECKS = 1');
    await connection.query('SET AUTOCOMMIT = 1');

    console.log('✅ All imports completed!');
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    await connection.query('ROLLBACK');
  } finally {
    await connection.end();
  }
}

importAllCSVs();
