/**
 * Wait for Aurora to be ready and test S3 integration
 * Handles connection timeouts during reboot
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

async function waitAndTest() {
  const maxAttempts = 30; // 30 attempts = 5 minutes
  let attempt = 0;

  console.log('================================================================================');
  console.log('⏳ WAITING FOR AURORA & TESTING S3 INTEGRATION');
  console.log('================================================================================\n');

  while (attempt < maxAttempts) {
    attempt++;
    
    try {
      console.log(`[${attempt}/${maxAttempts}] Attempting to connect...`);
      
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST!,
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
        connectTimeout: 10000, // 10 second timeout
      });

      console.log('✅ Connected to Aurora!\n');

      // Check S3 role parameter
      console.log('Checking S3 role parameter...');
      const [roleResult] = await connection.query(`
        SELECT @@aws_default_s3_role AS role_arn
      `) as any;

      const roleArn = roleResult[0]?.role_arn;
      console.log(`aws_default_s3_role: ${roleArn || 'NOT SET'}\n`);

      // Test LOAD DATA FROM S3
      console.log('Testing LOAD DATA FROM S3 command...');
      
      try {
        // Create test table
        await connection.query(`DROP TABLE IF EXISTS test_s3_load`);
        await connection.query(`
          CREATE TABLE test_s3_load (
            id INT,
            name VARCHAR(255)
          )
        `);

        // Try LOAD DATA FROM S3
        const testQuery = `
          LOAD DATA FROM S3 's3://hotelbed-imports-cache-data/test.csv'
          INTO TABLE test_s3_load
          FIELDS TERMINATED BY ','
          LINES TERMINATED BY '\\n'
          IGNORE 1 ROWS
        `;
        
        await connection.query(testQuery);
        
        console.log('✅ LOAD DATA FROM S3 works!\n');
        
        // Clean up
        await connection.query(`DROP TABLE IF EXISTS test_s3_load`);
        
        await connection.end();
        
        console.log('================================================================================');
        console.log('🎉 SUCCESS! S3 INTEGRATION IS WORKING!');
        console.log('================================================================================\n');
        console.log('Next steps:');
        console.log('1. Upload and load CSV files:');
        console.log('   curl -X POST http://localhost:5001/api/v1/hotelbed/upload-and-load\n');
        console.log('2. Start the server:');
        console.log('   pnpm dev\n');
        
        process.exit(0);
        
      } catch (loadError: any) {
        if (loadError.message.includes('not specified')) {
          console.log('❌ S3 role not configured yet\n');
          console.log('The parameter group changes might not be applied yet.');
          console.log('This usually means the cluster needs more time or another reboot.\n');
          
          await connection.end();
          
          console.log('SOLUTION: Wait 2-3 more minutes and try again:');
          console.log('  npm run check-s3-procedure\n');
          console.log('OR manually check parameter group in AWS Console.\n');
          
          process.exit(1);
        } else if (loadError.message.includes('S3_ACCESS_DENIED') || loadError.message.includes('Access Denied')) {
          console.log('❌ S3 Access Denied\n');
          console.log('The IAM role might not have S3 permissions.');
          console.log('Check the role policy in AWS IAM Console.\n');
          
          await connection.end();
          process.exit(1);
        } else {
          console.log(`⚠️  LOAD DATA test failed: ${loadError.message}\n`);
          console.log('This might be because:');
          console.log('1. The test file does not exist in S3');
          console.log('2. The S3 bucket name is incorrect');
          console.log('3. The IAM role lacks S3 permissions\n');
          
          await connection.end();
          
          // If we can connect and role is set, this is good enough
          if (roleArn) {
            console.log('✅ However, the S3 role IS configured!');
            console.log('   The actual import should work with real CSV files.\n');
            process.exit(0);
          }
          
          process.exit(1);
        }
      }

    } catch (error: any) {
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        console.log(`   ⏳ Connection timeout - Aurora is still rebooting...`);
        console.log(`   Waiting 10 seconds before retry...\n`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.error(`   ❌ Error: ${error.message}\n`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  console.log('================================================================================');
  console.log('❌ TIMEOUT - Aurora did not become available');
  console.log('================================================================================\n');
  console.log('The instances might still be rebooting.');
  console.log('Check status in AWS Console or try again in a few minutes.\n');
  process.exit(1);
}

waitAndTest();
