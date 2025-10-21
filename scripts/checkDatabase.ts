import pool from '@config/database';

async function checkDatabase() {
  console.log('\n🔍 DATABASE VERIFICATION\n');
  console.log('='.repeat(70));

  try {
    const tables = [
      'hotels',
      'categories', 
      'chains',
      'destinations',
      'hotel_contracts',
      'hotel_rates',
      'hotel_inventory',
      'hotel_room_allocations',
      'hotel_supplements',
      'hotel_occupancy_rules',
      'hotel_email_settings',
      'hotel_rate_tags',
      'hotel_configurations',
      'hotel_promotions',
      'hotel_special_requests',
      'hotel_groups',
      'hotel_cancellation_policies',
      'hotel_special_conditions',
      'hotel_room_features',
      'hotel_pricing_rules',
      'hotel_tax_info'
    ];

    const results: any[] = [];

    for (const table of tables) {
      try {
        const [rows]: any = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = rows[0].count;
        
        let status = '';
        if (count === 0) {
          status = '⚠️  Empty';
        } else if (count < 100) {
          status = '⚠️  Sparse';
        } else if (count < 10000) {
          status = '⏳ Growing';
        } else if (count < 100000) {
          status = '✅ Good';
        } else {
          status = '✅ Excellent';
        }

        results.push({
          table,
          count,
          status
        });
      } catch (error: any) {
        results.push({
          table,
          count: 0,
          status: `❌ Error: ${error.message.substring(0, 30)}`
        });
      }
    }

    // Sort by count
    results.sort((a, b) => b.count - a.count);

    // Display results
    console.log('\n📊 TABLE DATA COUNTS:\n');
    console.log('Table Name'.padEnd(35), 'Records'.padStart(15), '  Status');
    console.log('-'.repeat(70));

    for (const r of results) {
      const countStr = r.count.toLocaleString();
      console.log(
        r.table.padEnd(35),
        countStr.padStart(15),
        ' ',
        r.status
      );
    }

    console.log('='.repeat(70));

    // Summary
    const totalRecords = results.reduce((sum, r) => sum + r.count, 0);
    const tablesWithData = results.filter(r => r.count > 0).length;
    const emptyTables = results.filter(r => r.count === 0).length;

    console.log('\n📈 SUMMARY:');
    console.log(`   Total Records: ${totalRecords.toLocaleString()}`);
    console.log(`   Tables with Data: ${tablesWithData}/${results.length}`);
    console.log(`   Empty Tables: ${emptyTables}`);
    console.log('');

    // Top 5 tables
    console.log('🏆 TOP 5 TABLES:');
    results.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.table}: ${r.count.toLocaleString()} records`);
    });

    console.log('\n✅ Database check complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();

