const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const csvDir = path.join(__dirname, 'downloads', 'csv_output');

const tables = [
  { name: 'hotels', csv: 'hotels.csv', columns: '(id,category,destination_code,chain_code,accommodation_type,ranking,group_hotel,country_code,state_code,longitude,latitude,name)' },
  { name: 'destinations', csv: 'destinations.csv', columns: '(code,country_code,is_available)' },
  { name: 'categories', csv: 'categories.csv', columns: '(code,simple_code)' },
  { name: 'hotel_contracts', csv: 'hotel_contracts.csv', columns: '(hotel_id,destination_code,contract_code,rate_code,board_code,contract_type,date_from,date_to,currency,board_type)' },
  { name: 'hotel_room_allocations', csv: 'hotel_room_allocations.csv', columns: '(hotel_id,room_code,board_code,min_adults,max_adults,min_children,max_children,min_pax,max_pax,allocation)' },
  { name: 'hotel_inventory', csv: 'hotel_inventory.csv', columns: '(hotel_id,room_code,board_code,date_from,date_to,availability_data)' },
  { name: 'hotel_rates', csv: 'hotel_rates.csv', columns: '(hotel_id,room_code,board_code,date_from,date_to,rate_type,base_price,tax_amount,adults,board_type,price)' },
  { name: 'hotel_supplements', csv: 'hotel_supplements.csv', columns: '(hotel_id,date_from,date_to,supplement_code,supplement_type,discount_percent,min_nights)' },
  { name: 'hotel_occupancy_rules', csv: 'hotel_occupancy_rules.csv', columns: '(hotel_id,rule_from,rule_to,is_allowed)' },
  { name: 'hotel_email_settings', csv: 'hotel_email_settings.csv', columns: '' },
  { name: 'hotel_rate_tags', csv: 'hotel_rate_tags.csv', columns: '' },
  { name: 'hotel_configurations', csv: 'hotel_configurations.csv', columns: '' },
  { name: 'hotel_groups', csv: 'hotel_groups.csv', columns: '' },
  { name: 'hotel_special_requests', csv: 'hotel_special_requests.csv', columns: '' },
  { name: 'hotel_special_conditions', csv: 'hotel_special_conditions.csv', columns: '' },
  { name: 'hotel_pricing_rules', csv: 'hotel_pricing_rules.csv', columns: '' },
  { name: 'hotel_cancellation_policies', csv: 'hotel_cancellation_policies.csv', columns: '' },
  { name: 'hotel_room_features', csv: 'hotel_room_features.csv', columns: '' },
  { name: 'hotel_promotions', csv: 'hotel_promotions.csv', columns: '' },
  { name: 'hotel_tax_info', csv: 'hotel_tax_info.csv', columns: '' },
];

async function manualImport() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    infileStreamFactory: (filePath) => fs.createReadStream(filePath),
  });

  try {
    console.log('🔧 Setting up database...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('SET UNIQUE_CHECKS = 0');
    await connection.query('SET AUTOCOMMIT = 0');
    await connection.query('SET SESSION wait_timeout = 86400');
    await connection.query('SET SESSION net_read_timeout = 86400');
    await connection.query('SET SESSION net_write_timeout = 86400');

    for (const table of tables) {
      const csvPath = path.join(csvDir, table.csv);
      
      if (!fs.existsSync(csvPath)) {
        console.log(`⏭️  Skipping ${table.name} (no CSV)`);
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
        ${table.columns}
      `;

      const [result] = await connection.query(query);
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`✅ ${table.name} loaded in ${duration}s (${result.affectedRows} rows)`);
    }

    console.log('💾 Committing...');
    await connection.query('COMMIT');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.query('SET UNIQUE_CHECKS = 1');
    await connection.query('SET AUTOCOMMIT = 1');

    console.log('✅ Import complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await connection.query('ROLLBACK');
  } finally {
    await connection.end();
  }
}

manualImport();
