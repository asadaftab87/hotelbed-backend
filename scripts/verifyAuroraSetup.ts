import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';
import { S3Uploader } from '@/utils/s3Uploader';

dotenv.config();

async function verifyAuroraSetup() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 AURORA SETUP VERIFICATION');
  console.log('='.repeat(80) + '\n');

  let allChecksPassed = true;

  // ============================================
  // CHECK 1: Environment Variables
  // ============================================
  console.log('📋 CHECK 1: Environment Variables');
  console.log('─'.repeat(80));

  const requiredVars = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'AWS_REGION',
    'AWS_S3_BUCKET',
  ];

  const missingVars: string[] = [];
  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:');
    missingVars.forEach((v) => console.log(`   - ${v}`));
    allChecksPassed = false;
  } else {
    console.log('✅ All required environment variables set');
    console.log(`   DB_HOST: ${process.env.DB_HOST}`);
    console.log(`   DB_USER: ${process.env.DB_USER}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME}`);
    console.log(`   AWS_REGION: ${process.env.AWS_REGION}`);
    console.log(`   AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET}`);
  }

  console.log('');

  // ============================================
  // CHECK 2: Database Connection
  // ============================================
  console.log('🔌 CHECK 2: Database Connection');
  console.log('─'.repeat(80));

  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✅ Database connection successful!');
  } catch (error: any) {
    console.log('❌ Database connection failed:');
    console.log(`   Error: ${error.message}`);
    allChecksPassed = false;
    return; // Can't continue without DB connection
  }

  console.log('');

  // ============================================
  // CHECK 3: Aurora Version
  // ============================================
  console.log('🔍 CHECK 3: Aurora Version');
  console.log('─'.repeat(80));

  try {
    const [rows]: any = await connection.query('SELECT @@aurora_version as version');
    const version = rows[0]?.version;

    if (version) {
      console.log(`✅ Aurora MySQL detected!`);
      console.log(`   Version: ${version}`);
    } else {
      console.log('❌ NOT Aurora MySQL!');
      console.log('   This is regular RDS MySQL. S3 integration not supported.');
      allChecksPassed = false;
    }
  } catch (error: any) {
    console.log(`❌ Error checking Aurora version: ${error.message}`);
    allChecksPassed = false;
  }

  console.log('');

  // ============================================
  // CHECK 4: Database Exists
  // ============================================
  console.log('🗄️  CHECK 4: Database Exists');
  console.log('─'.repeat(80));

  try {
    const [rows]: any = await connection.query(`SELECT DATABASE() as current_db`);
    const currentDb = rows[0]?.current_db;

    if (currentDb === process.env.DB_NAME) {
      console.log(`✅ Connected to database: ${currentDb}`);
    } else {
      console.log(`⚠️  Connected to: ${currentDb || 'none'}`);
      console.log(`   Expected: ${process.env.DB_NAME}`);
      console.log('   Attempting to use database...');

      try {
        await connection.query(`USE ${process.env.DB_NAME}`);
        console.log(`✅ Successfully switched to: ${process.env.DB_NAME}`);
      } catch (err: any) {
        console.log(`❌ Database "${process.env.DB_NAME}" does not exist!`);
        console.log(`   Create it: CREATE DATABASE ${process.env.DB_NAME};`);
        allChecksPassed = false;
      }
    }
  } catch (error: any) {
    console.log(`❌ Error checking database: ${error.message}`);
    allChecksPassed = false;
  }

  console.log('');

  // ============================================
  // CHECK 5: Tables Exist
  // ============================================
  console.log('📊 CHECK 5: Tables Status');
  console.log('─'.repeat(80));

  const requiredTables = [
    'hotels',
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
    'hotel_tax_info',
    'destinations',
  ];

  try {
    const [tables]: any = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [process.env.DB_NAME]
    );

    const existingTables = tables.map((t: any) => t.TABLE_NAME);
    const missingTables = requiredTables.filter((t) => !existingTables.includes(t));

    if (missingTables.length === 0) {
      console.log(`✅ All ${requiredTables.length} required tables exist`);
    } else {
      console.log(`⚠️  Missing tables: ${missingTables.length}`);
      console.log(`   Existing: ${existingTables.length}`);
      console.log(`   Missing: ${missingTables.join(', ')}`);
      console.log('   Run: npm run create-tables');
    }
  } catch (error: any) {
    console.log(`❌ Error checking tables: ${error.message}`);
    allChecksPassed = false;
  }

  console.log('');

  // ============================================
  // CHECK 6: S3 Integration (IAM Role)
  // ============================================
  console.log('🔐 CHECK 6: S3 Integration (IAM Role)');
  console.log('─'.repeat(80));

  try {
    const [rows]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration');

    if (rows.length > 0) {
      console.log('✅ S3 integration role attached!');
      rows.forEach((row: any, idx: number) => {
        console.log(`   Role ${idx + 1}: ${row.arn}`);
      });
    } else {
      console.log('⚠️  S3 integration role NOT attached yet!');
      console.log('   Steps to fix:');
      console.log('   1. RDS Console → Aurora cluster → Modify');
      console.log('   2. Manage IAM roles → Add: AuroraS3AccessRole');
      console.log('   3. Run in MySQL:');
      console.log('      CALL mysql.rds_add_s3_integration_role(\'arn:aws:iam::ACCOUNT:role/AuroraS3AccessRole\');');
      allChecksPassed = false;
    }
  } catch (error: any) {
    if (error.message.includes("doesn't exist")) {
      console.log('⚠️  S3 integration table not accessible');
      console.log('   This might mean role is not attached to cluster');
    } else {
      console.log(`❌ Error checking S3 integration: ${error.message}`);
    }
    allChecksPassed = false;
  }

  console.log('');

  // ============================================
  // CHECK 7: S3 Bucket Access
  // ============================================
  console.log('☁️  CHECK 7: S3 Bucket Access');
  console.log('─'.repeat(80));

  try {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      const s3Uploader = new S3Uploader(
        process.env.AWS_S3_BUCKET || '',
        'hotelbed-csv'
      );

      const canConnect = await s3Uploader.testConnection();

      if (canConnect) {
        console.log(`✅ S3 bucket accessible: ${process.env.AWS_S3_BUCKET}`);
      } else {
        console.log(`❌ Cannot access S3 bucket: ${process.env.AWS_S3_BUCKET}`);
        console.log('   Check AWS credentials and bucket permissions');
        allChecksPassed = false;
      }
    } else {
      console.log('⚠️  AWS credentials not set in environment');
      console.log('   Set: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    }
  } catch (error: any) {
    console.log(`❌ Error checking S3: ${error.message}`);
    allChecksPassed = false;
  }

  console.log('');

  // ============================================
  // CHECK 8: Test LOAD DATA FROM S3
  // ============================================
  console.log('🧪 CHECK 8: Test LOAD DATA FROM S3 (Optional)');
  console.log('─'.repeat(80));

  try {
    // Create test table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS test_s3_load (
        id INT,
        name VARCHAR(100)
      )
    `);

    // Try to load from S3 (will fail if not set up, but we'll catch it)
    console.log('   Note: This test requires a CSV file in S3');
    console.log('   Skipping actual test (will test during import)');
    console.log('✅ Test table created (ready for S3 load test)');

    // Cleanup
    await connection.query('DROP TABLE IF EXISTS test_s3_load');
  } catch (error: any) {
    console.log(`⚠️  S3 load test skipped: ${error.message}`);
  }

  console.log('');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('='.repeat(80));
  if (allChecksPassed) {
    console.log('✅ ALL CHECKS PASSED - Ready for import!');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Ensure S3 IAM role is attached (if Check 6 failed)');
    console.log('   2. Create tables if missing (npm run create-tables)');
    console.log('   3. Test import: GET /api/hotelbed/import-only');
  } else {
    console.log('⚠️  SOME CHECKS FAILED - Please fix issues above');
    console.log('');
    console.log('🔧 Fix required issues before running import');
  }
  console.log('='.repeat(80) + '\n');

  if (connection) {
    await connection.end();
  }
}

// Run verification
verifyAuroraSetup()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });

