import pool from '@config/database';
import Logger from '@/core/Logger';
import fs from 'fs';
import path from 'path';
import { env } from '@config/globals';

/**
 * ⚠️ DANGER: Complete Database Reset Script
 * 
 * This script will:
 * 1. DROP ALL existing tables (including old app data)
 * 2. Create fresh HotelBed schema
 * 3. Prepare database for first import
 * 
 * USE WITH CAUTION - ALL DATA WILL BE LOST!
 */

async function resetDatabase() {
  console.log('\n========================================');
  console.log('🔥 COMPLETE DATABASE RESET');
  console.log('========================================\n');

  console.log('⚠️  WARNING: This will DESTROY all existing data!');
  console.log(`📍 Database: ${env.DB_NAME}`);
  console.log(`🌐 Host: ${env.DB_HOST}`);
  console.log('\n⏳ Starting in 3 seconds...\n');

  // Wait 3 seconds to give user time to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // Step 1: Get all existing tables
    console.log('📋 Step 1/3: Finding all existing tables...');
    const [tables]: any = await pool.query(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ?`,
      [env.DB_NAME]
    );

    const tableNames = tables.map((t: any) => t.TABLE_NAME);
    console.log(`   Found ${tableNames.length} existing tables`);
    if (tableNames.length > 0) {
      console.log(`   Tables: ${tableNames.slice(0, 5).join(', ')}${tableNames.length > 5 ? '...' : ''}`);
    }

    // Step 2: Drop all existing tables
    if (tableNames.length > 0) {
      console.log('\n🗑️  Step 2/3: Dropping all existing tables...');
      
      // Disable foreign key checks
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      console.log('   ✓ Foreign key checks disabled');

      let dropped = 0;
      for (const tableName of tableNames) {
        try {
          await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
          dropped++;
          console.log(`   ✓ Dropped: ${tableName}`);
        } catch (error: any) {
          console.log(`   ✗ Failed to drop: ${tableName} (${error.message})`);
        }
      }

      // Re-enable foreign key checks
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('   ✓ Foreign key checks re-enabled');
      console.log(`\n   ✅ Dropped ${dropped}/${tableNames.length} tables`);
    } else {
      console.log('\n✓ Step 2/3: No tables to drop (database is empty)');
    }

    // Step 3: Create fresh HotelBed schema
    console.log('\n🏗️  Step 3/3: Creating fresh HotelBed schema...');
    
    const schemaPath = path.join(__dirname, '../database/hotelbed_complete_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    // Split into individual statements
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`   Found ${statements.length} SQL statements`);

    let created = 0;
    for (const statement of statements) {
      try {
        await pool.query(statement);
        
        // Extract table name from CREATE TABLE statement
        const match = statement.match(/CREATE TABLE.*?`([^`]+)`/i);
        if (match) {
          console.log(`   ✓ Created: ${match[1]}`);
          created++;
        }
      } catch (error: any) {
        // Ignore "table already exists" errors
        if (!error.message.includes('already exists')) {
          console.log(`   ✗ Error: ${error.message.substring(0, 80)}...`);
        }
      }
    }

    console.log(`\n   ✅ Created ${created} tables successfully`);

    // Step 4: Verify tables
    console.log('\n✅ Verification: Checking created tables...');
    const [newTables]: any = await pool.query(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [env.DB_NAME]
    );

    console.log(`\n📊 Total tables in database: ${newTables.length}`);
    console.log('\n📋 HotelBed Tables Created:');
    
    const hotelBedTables = [
      'api_metadata',
      'hotels',
      'categories', 
      'chains',
      'destinations',
      'hotel_contracts',
      'hotel_room_allocations',
      'hotel_inventory',
      'hotel_rates',
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
      'hotel_tax_info',
      'import_logs',
      'processing_queue'
    ];

    const createdTableNames = newTables.map((t: any) => t.TABLE_NAME);
    
    for (const table of hotelBedTables) {
      const exists = createdTableNames.includes(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }

    console.log('\n========================================');
    console.log('✅ DATABASE RESET COMPLETED SUCCESSFULLY!');
    console.log('========================================\n');
    
    console.log('📝 Summary:');
    console.log(`   • Old tables dropped: ${tableNames.length}`);
    console.log(`   • New tables created: ${created}`);
    console.log(`   • Total tables now: ${newTables.length}`);
    console.log('\n🚀 Database is ready for HotelBed data import!');
    console.log('   Run: curl http://localhost:5001/api/v1/hotelbed/process\n');

    Logger.info('Database reset completed successfully', {
      oldTables: tableNames.length,
      newTables: created,
      totalTables: newTables.length
    });

  } catch (error: any) {
    console.error('\n❌ DATABASE RESET FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    
    Logger.error('Database reset failed', {
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run the reset
resetDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

