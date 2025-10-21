import pool from '@config/database';
import Logger from '@/core/Logger';
import { env } from '@config/globals';
import fs from 'fs';
import path from 'path';

async function createTables() {
  console.log('\n========================================');
  console.log('🏗️  CREATE HOTELBED TABLES');
  console.log('========================================\n');

  console.log('📍 Database Information:');
  console.log(`   • Database: ${env.DB_NAME}`);
  console.log(`   • Host: ${env.DB_HOST}`);
  console.log(`   • Port: ${env.DB_PORT}`);
  console.log(`   • User: ${env.DB_USER}\n`);

  try {
    console.log('📋 Loading schema file...');
    
    // Use COMPLETE schema file (24 tables)
    const schemaPath = path.join(__dirname, '../database/hotelbed_complete_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log(`✅ Schema file loaded: hotelbed_complete_schema.sql\n`);
    
    // Remove comment lines first
    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    // Split by semicolon and execute each statement
    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 10); // At least 10 chars to be a valid statement
    
    console.log(`📊 Found ${statements.length} SQL statements\n`);
    console.log('🔨 Creating tables...\n');
    
    let created = 0;
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
          
          // Extract table name from CREATE TABLE statement
          const match = statement.match(/CREATE TABLE.*?`([^`]+)`/i);
          if (match) {
            console.log(`   ✅ Created: ${match[1]}`);
            created++;
          }
        } catch (error: any) {
          // Ignore "table already exists" errors
          if (error.message.includes('already exists')) {
            const match = statement.match(/CREATE TABLE.*?`([^`]+)`/i);
            if (match) {
              console.log(`   ⚠️  Already exists: ${match[1]}`);
            }
          } else {
            console.log(`   ❌ Error: ${error.message.substring(0, 80)}`);
          }
        }
      }
    }
    
    console.log('\n========================================');
    console.log('✅ TABLE CREATION COMPLETED!');
    console.log('========================================\n');
    
    console.log(`📊 Summary:`);
    console.log(`   • Tables created: ${created}`);
    console.log(`   • Database: ${env.DB_NAME}`);
    console.log(`   • Host: ${env.DB_HOST}\n`);

    Logger.info('Tables created successfully', {
      tablesCreated: created,
      database: env.DB_NAME,
      host: env.DB_HOST
    });
    
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TABLE CREATION FAILED!\n');
    console.error('Error:', error.message);
    
    Logger.error('Table creation failed', {
      error: error.message,
      database: env.DB_NAME
    });
    
    await pool.end();
    process.exit(1);
  }
}

createTables();

