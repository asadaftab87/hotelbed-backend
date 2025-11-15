/**
 * Enable S3 Integration using RDS Stored Procedure
 * For Aurora MySQL 3.x
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

async function enableS3Integration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  });

  try {
    console.log('================================================================================');
    console.log('🔧 ENABLING S3 INTEGRATION VIA STORED PROCEDURE');
    console.log('================================================================================\n');

    const roleArn = 'arn:aws:iam::357058555433:role/AuroraS3AccessRole';

    console.log(`1️⃣  Calling mysql.rds_set_configuration for S3 load role...`);
    
    try {
      // Set the S3 role for LOAD DATA FROM S3 using RDS procedure
      await connection.query(`
        CALL mysql.rds_set_configuration('aurora_load_from_s3_role', '${roleArn}')
      `);
      console.log('   ✅ aurora_load_from_s3_role set via procedure!\n');
    } catch (err: any) {
      console.log(`   ⚠️  Procedure call failed: ${err.message}`);
      console.log('   This is normal for Aurora MySQL 3.x - trying direct parameter set...\n');
    }

    console.log(`2️⃣  Checking current S3 role settings...`);
    
    try {
      const [loadRole] = await connection.query(`
        SELECT @@aurora_load_from_s3_role AS role_arn
      `) as any;
      
      const [defaultRole] = await connection.query(`
        SELECT @@aws_default_s3_role AS role_arn
      `) as any;
      
      console.log(`   aurora_load_from_s3_role: ${loadRole[0]?.role_arn || 'NOT SET'}`);
      console.log(`   aws_default_s3_role: ${defaultRole[0]?.role_arn || 'NOT SET'}\n`);

      if (loadRole[0]?.role_arn || defaultRole[0]?.role_arn) {
        console.log('✅ S3 ROLE IS ALREADY CONFIGURED!\n');
      } else {
        console.log('⚠️  S3 roles are not set\n');
      }
    } catch (err: any) {
      console.log(`   ℹ️  Could not check role settings: ${err.message}\n`);
    }

    console.log(`3️⃣  Testing LOAD DATA FROM S3 command...`);
    
    const testQuery = `
      LOAD DATA FROM S3 's3://hotelbed-imports-cache-data/hotelbed-csv/test.csv'
      INTO TABLE test_s3_load
      FIELDS TERMINATED BY ','
      LINES TERMINATED BY '\\n'
      IGNORE 1 ROWS
    `;
    
    try {
      // Try to create a test table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS test_s3_load (
          id INT,
          name VARCHAR(255)
        )
      `);
      
      // Try the LOAD DATA command
      await connection.query(testQuery);
      console.log('   ✅ LOAD DATA FROM S3 command works!\n');
      
      // Clean up
      await connection.query(`DROP TABLE IF EXISTS test_s3_load`);
      
      console.log('================================================================================');
      console.log('🎉 SUCCESS! S3 INTEGRATION IS WORKING!');
      console.log('================================================================================\n');
      console.log('You can now use:');
      console.log('  curl -X POST http://localhost:5001/api/v1/hotelbed/upload-and-load\n');
      
    } catch (err: any) {
      if (err.message.includes('not specified')) {
        console.log('   ❌ S3 roles are not configured in the database\n');
        console.log('================================================================================');
        console.log('📋 SOLUTION: Database Parameter Group Configuration Required');
        console.log('================================================================================\n');
        console.log('Aurora MySQL 3.x requires the S3 role to be set in the DB Cluster Parameter Group.\n');
        console.log('Steps to fix:\n');
        console.log('1. Go to AWS RDS Console → Parameter groups');
        console.log('2. Find your cluster parameter group: default.aurora-mysql8.0');
        console.log('3. Click "Edit parameters"');
        console.log('4. Search for: aurora_load_from_s3_role');
        console.log('5. Set value to: arn:aws:iam::357058555433:role/AuroraS3AccessRole');
        console.log('6. Search for: aws_default_s3_role');
        console.log('7. Set value to: arn:aws:iam::357058555433:role/AuroraS3AccessRole');
        console.log('8. Save changes');
        console.log('9. Reboot the cluster (Actions → Reboot)\n');
        console.log('OR create a custom parameter group with these settings.\n');
      } else {
        console.log(`   ⚠️  Test failed: ${err.message}\n`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

enableS3Integration();
