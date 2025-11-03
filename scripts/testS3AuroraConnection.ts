import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function testS3AuroraConnection() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING S3 → AURORA CONNECTION');
  console.log('='.repeat(80) + '\n');

  const DB_HOST = process.env.DB_HOST;
  const DB_USER = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD;
  const DB_NAME = process.env.DB_NAME;
  const S3_BUCKET = process.env.AWS_S3_BUCKET;
  const S3_PREFIX = 'hotelbed-csv';

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME || !S3_BUCKET) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  let connection: mysql.Connection | null = null;

  try {
    // Step 1: Connect to Aurora
    console.log('🔌 Step 1: Connecting to Aurora...');
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });
    console.log('✅ Connected successfully!\n');

    // Step 2: Check S3 Integration
    console.log('🔍 Step 2: Checking S3 Integration...');
    try {
      const [s3Rows]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration');
      if (s3Rows.length > 0) {
        console.log('✅ S3 Integration Enabled:');
        s3Rows.forEach((row: any, idx: number) => {
          console.log(`   Role ${idx + 1}: ${row.arn}`);
        });
      } else {
        console.log('⚠️  S3 Integration NOT enabled (table exists but empty)');
        console.log('   Run: npm run enable-s3');
      }
    } catch (error: any) {
      if (error.message.includes("doesn't exist")) {
        console.log('❌ S3 Integration table does not exist');
        console.log('   This means S3 integration is not set up');
        console.log('   Run: npm run enable-s3');
      } else {
        throw error;
      }
    }
    console.log('');

    // Step 3: Create test CSV file
    console.log('📝 Step 3: Creating test CSV file...');
    const testCsvPath = path.join(process.cwd(), 'test_aurora_s3.csv');
    const testCsvContent = `id,name,value
1,test1,value1
2,test2,value2
3,test3,value3`;
    fs.writeFileSync(testCsvPath, testCsvContent);
    console.log(`✅ Test CSV created: ${testCsvPath}\n`);

    // Step 4: Upload test CSV to S3
    console.log('☁️  Step 4: Uploading test CSV to S3...');
    const s3 = new AWS.S3({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const s3Key = `${S3_PREFIX}/test_aurora_s3.csv`;
    await s3
      .upload({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: testCsvContent,
        ContentType: 'text/csv',
      })
      .promise();
    console.log(`✅ Uploaded to S3: s3://${S3_BUCKET}/${s3Key}\n`);

    // Step 5: Create test table
    console.log('🗄️  Step 5: Creating test table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS test_s3_import (
        id INT PRIMARY KEY,
        name VARCHAR(100),
        value VARCHAR(100)
      )
    `);
    await connection.query('TRUNCATE TABLE test_s3_import');
    console.log('✅ Test table created and cleaned\n');

    // Step 6: Test LOAD DATA FROM S3
    console.log('🧪 Step 6: Testing LOAD DATA FROM S3...');
    const s3Url = `s3://${S3_BUCKET}/${s3Key}`;
    console.log(`   S3 URL: ${s3Url}`);

    try {
      const query = `
        LOAD DATA FROM S3 '${s3Url}'
        INTO TABLE test_s3_import
        FIELDS TERMINATED BY ','
        ENCLOSED BY '"'
        LINES TERMINATED BY '\\n'
        IGNORE 1 ROWS
      `;

      const [result]: any = await connection.query(query);
      console.log(`✅ LOAD DATA FROM S3 SUCCESSFUL!`);
      console.log(`   Rows affected: ${result.affectedRows || 'unknown'}\n`);

      // Step 7: Verify data loaded
      console.log('🔍 Step 7: Verifying loaded data...');
      const [rows]: any = await connection.query('SELECT * FROM test_s3_import');
      console.log(`✅ Data loaded successfully: ${rows.length} rows`);
      console.table(rows);
      console.log('');

      // Cleanup
      console.log('🧹 Cleaning up...');
      await connection.query('DROP TABLE test_s3_import');
      
      // Delete from S3
      await s3.deleteObject({ Bucket: S3_BUCKET, Key: s3Key }).promise();
      
      // Delete local file
      fs.unlinkSync(testCsvPath);
      console.log('✅ Cleanup complete\n');

      console.log('='.repeat(80));
      console.log('✅ S3 → AURORA CONNECTION TEST PASSED!');
      console.log('='.repeat(80));
      console.log('✅ S3 integration is working');
      console.log('✅ Aurora can load data from S3');
      console.log('✅ Ready for production import!\n');

    } catch (error: any) {
      console.error(`\n❌ LOAD DATA FROM S3 FAILED:`);
      console.error(`   Error: ${error.message}`);
      console.error(`   S3 URL: ${s3Url}\n`);

      if (error.message.includes('Access denied') || error.message.includes('Access Denied')) {
        console.error('⚠️  S3 Access Issue:');
        console.error('   1. Check IAM role is attached to Aurora cluster');
        console.error('   2. Run: npm run enable-s3');
        console.error('   3. Verify role permissions allow S3 access');
      } else if (error.message.includes('does not exist') || error.message.includes('not found')) {
        console.error('⚠️  S3 File Issue:');
        console.error('   1. Check S3 URL is correct');
        console.error('   2. Verify file exists in S3 bucket');
        console.error('   3. Check bucket permissions');
      } else {
        console.error('⚠️  Unknown error - check logs above');
      }

      // Cleanup on error
      try {
        await connection.query('DROP TABLE IF EXISTS test_s3_import');
        await s3.deleteObject({ Bucket: S3_BUCKET, Key: s3Key }).promise();
        fs.unlinkSync(testCsvPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testS3AuroraConnection();


