/**
 * Test S3 Integration End-to-End
 * Creates a test CSV, uploads to S3, loads to Aurora
 */

import mysql from 'mysql2/promise';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import fs from 'fs';

config();

async function testS3Integration() {
  console.log('================================================================================');
  console.log('🧪 END-TO-END S3 INTEGRATION TEST');
  console.log('================================================================================\n');

  // Step 1: Create test CSV
  console.log('1️⃣  Creating test CSV file...');
  const testCsv = 'id,name,value\n1,Test,100\n2,Sample,200\n3,Data,300\n';
  const testFile = '/tmp/test_s3_aurora.csv';
  fs.writeFileSync(testFile, testCsv);
  console.log(`   ✅ Created: ${testFile}\n`);

  // Step 2: Upload to S3
  console.log('2️⃣  Uploading to S3...');
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const bucket = process.env.AWS_S3_BUCKET || 'hotelbed-imports-cache-data';
  const key = 'test/test_aurora_load.csv';

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.readFileSync(testFile),
    }));
    console.log(`   ✅ Uploaded to: s3://${bucket}/${key}\n`);
  } catch (s3Err: any) {
    console.log(`   ❌ S3 Upload failed: ${s3Err.message}\n`);
    return;
  }

  // Step 3: Connect to Aurora
  console.log('3️⃣  Connecting to Aurora...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  });
  console.log('   ✅ Connected\n');

  try {
    // Step 4: Create test table
    console.log('4️⃣  Creating test table...');
    await connection.query(`DROP TABLE IF EXISTS test_s3_integration`);
    await connection.query(`
      CREATE TABLE test_s3_integration (
        id INT,
        name VARCHAR(255),
        value INT
      )
    `);
    console.log('   ✅ Table created\n');

    // Step 5: Test LOAD DATA FROM S3
    console.log('5️⃣  Testing LOAD DATA FROM S3...');
    const s3Path = `s3://${bucket}/${key}`;
    console.log(`   Loading from: ${s3Path}`);

    const loadQuery = `
      LOAD DATA FROM S3 '${s3Path}'
      INTO TABLE test_s3_integration
      FIELDS TERMINATED BY ','
      LINES TERMINATED BY '\\n'
      IGNORE 1 ROWS
      (id, name, value)
    `;

    await connection.query(loadQuery);
    console.log('   ✅ LOAD DATA FROM S3 succeeded!\n');

    // Step 6: Verify data
    console.log('6️⃣  Verifying loaded data...');
    const [rows] = await connection.query(`SELECT * FROM test_s3_integration`) as any;
    console.log(`   Loaded ${rows.length} rows:`);
    console.log(rows);
    console.log('');

    // Cleanup
    await connection.query(`DROP TABLE IF EXISTS test_s3_integration`);
    
    console.log('================================================================================');
    console.log('🎉 SUCCESS! S3 INTEGRATION IS FULLY WORKING!');
    console.log('================================================================================\n');
    console.log('You can now upload and load CSV files from S3!');
    console.log('Next step: Test the full import flow');
    console.log('  curl -X POST http://localhost:5001/api/v1/hotelbed/upload-and-load\n');

  } catch (loadErr: any) {
    console.log(`   ❌ LOAD DATA failed: ${loadErr.message}\n`);
    
    if (loadErr.message.includes('S3Stream')) {
      console.log('ERROR ANALYSIS: "Unable to initialize S3Stream"');
      console.log('This means:');
      console.log('1. IAM role policy might not have propagated yet (wait 1-2 minutes)');
      console.log('2. IAM role lacks GetObject permission on S3 bucket');
      console.log('3. S3 bucket policy blocks access from this role\n');
      console.log('SOLUTION: Check IAM role policy includes s3:GetObject permission\n');
    } else if (loadErr.message.includes('Access Denied')) {
      console.log('ERROR ANALYSIS: S3 Access Denied');
      console.log('The IAM role needs these permissions:');
      console.log('- s3:GetObject');
      console.log('- s3:ListBucket\n');
    } else {
      console.log('ERROR ANALYSIS: Unknown error');
      console.log('Check Aurora error logs in AWS Console\n');
    }
  } finally {
    await connection.end();
    fs.unlinkSync(testFile); // Clean up temp file
  }
}

testS3Integration().catch(console.error);
