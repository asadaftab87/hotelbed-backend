import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';

dotenv.config();

async function diagnoseS3Issue() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 COMPREHENSIVE S3 INTEGRATION DIAGNOSIS');
  console.log('='.repeat(80) + '\n');

  const DB_HOST = process.env.DB_HOST;
  const DB_USER = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD;
  const DB_NAME = process.env.DB_NAME;
  const IAM_ROLE_ARN = 'arn:aws:iam::357058555433:role/AuroraS3AccessRole';

  let connection: mysql.Connection | null = null;

  try {
    console.log('🔌 Connecting to Aurora...');
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });
    console.log('✅ Connected!\n');

    // Check 1: Aurora Version
    console.log('1️⃣  AURORA VERSION:');
    const [versionRows]: any = await connection.query('SELECT @@aurora_version as version');
    const version = versionRows[0]?.version;
    console.log(`   Version: ${version || 'Not detected'}`);
    if (!version) {
      console.log('   ⚠️  Warning: This might not be Aurora MySQL\n');
    } else {
      console.log('   ✅ Aurora detected\n');
    }

    // Check 2: Endpoint Type
    console.log('2️⃣  ENDPOINT TYPE:');
    console.log(`   Host: ${DB_HOST}`);
    if (DB_HOST?.includes('cluster-ro-')) {
      console.log('   ❌ Using READER endpoint (WRONG!)');
      console.log('   ⚠️  Must use WRITER endpoint (cluster-xxx, not cluster-ro-xxx)\n');
    } else if (DB_HOST?.includes('cluster-')) {
      console.log('   ✅ Using cluster endpoint (likely Writer)\n');
    } else {
      console.log('   ⚠️  Not a cluster endpoint format\n');
    }

    // Check 3: Procedure Existence
    console.log('3️⃣  PROCEDURE CHECK:');
    const [procRows]: any = await connection.query(
      `SELECT ROUTINE_NAME 
       FROM information_schema.ROUTINES 
       WHERE ROUTINE_SCHEMA = 'mysql' 
       AND ROUTINE_NAME = 'rds_add_s3_integration_role'`
    );

    if (procRows.length > 0) {
      console.log('   ✅ Procedure EXISTS!\n');
      console.log('   🚀 You can enable S3: npm run enable-s3-terminal\n');
    } else {
      console.log('   ❌ Procedure does NOT exist\n');
    }

    // Check 4: S3 Integration Table
    console.log('4️⃣  S3 INTEGRATION TABLE:');
    try {
      const [s3Rows]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration');
      if (s3Rows.length > 0) {
        console.log('   ✅ Table exists and has entries:');
        console.table(s3Rows);
      } else {
        console.log('   ⚠️  Table exists but is empty (S3 not enabled)\n');
      }
    } catch (s3Error: any) {
      if (s3Error.message.includes("doesn't exist")) {
        console.log('   ❌ Table does not exist (S3 integration not available)\n');
      } else {
        console.log(`   ⚠️  Error: ${s3Error.message}\n`);
      }
    }

    // Check 5: All RDS Procedures
    console.log('5️⃣  ALL RDS PROCEDURES:');
    const [allRdsProcs]: any = await connection.query(
      `SELECT ROUTINE_NAME 
       FROM information_schema.ROUTINES 
       WHERE ROUTINE_SCHEMA = 'mysql' 
       AND ROUTINE_NAME LIKE 'rds_%'
       ORDER BY ROUTINE_NAME`
    );
    console.log(`   Found ${allRdsProcs.length} RDS procedures`);
    
    // Check for S3-related
    const s3Related = allRdsProcs.filter((p: any) => 
      p.ROUTINE_NAME.toLowerCase().includes('s3')
    );
    
    if (s3Related.length > 0) {
      console.log('   S3-related procedures:');
      s3Related.forEach((p: any) => {
        console.log(`   - ${p.ROUTINE_NAME}`);
      });
    } else {
      console.log('   ⚠️  No S3-related procedures found\n');
    }
    console.log('');

    // Check 6: IAM Role ARN Format
    console.log('6️⃣  IAM ROLE ARN:');
    console.log(`   ${IAM_ROLE_ARN}`);
    const arnPattern = /^arn:aws:iam::\d+:role\/[\w-]+$/;
    if (arnPattern.test(IAM_ROLE_ARN)) {
      console.log('   ✅ Format is correct\n');
    } else {
      console.log('   ⚠️  Format might be incorrect\n');
    }

    // Check 7: Try Direct LOAD DATA (last resort test)
    console.log('7️⃣  DIRECT LOAD DATA TEST:');
    const testBucket = process.env.AWS_S3_BUCKET;
    const testKey = 'hotelbed-csv/test_aurora_s3.csv';
    
    if (testBucket) {
      try {
        // Create test table
        await connection.query(`
          CREATE TABLE IF NOT EXISTS test_direct_s3_load (
            id INT,
            name VARCHAR(100)
          )
        `);
        await connection.query('TRUNCATE TABLE test_direct_s3_load');

        const testS3Url = `s3://${testBucket}/${testKey}`;
        console.log(`   Testing: ${testS3Url}`);
        
        await connection.query(`
          LOAD DATA FROM S3 '${testS3Url}'
          INTO TABLE test_direct_s3_load
          FIELDS TERMINATED BY ','
          ENCLOSED BY '"'
          LINES TERMINATED BY '\\n'
          IGNORE 1 ROWS
        `);
        
        console.log('   ✅ SUCCESS! LOAD DATA FROM S3 works!\n');
        await connection.query('DROP TABLE test_direct_s3_load');
      } catch (loadError: any) {
        console.log(`   ❌ Failed: ${loadError.message}`);
        if (loadError.message.includes('aurora_load_from_s3_role') || 
            loadError.message.includes('aws_default_s3_role')) {
          console.log('   ⚠️  This confirms S3 integration is NOT enabled\n');
        } else {
          console.log(`   ⚠️  Different error (might be file not found)\n`);
        }
      }
    } else {
      console.log('   ⚠️  S3 bucket not configured in .env\n');
    }

    // SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('📋 DIAGNOSIS SUMMARY:');
    console.log('='.repeat(80) + '\n');

    const issues: string[] = [];
    const successes: string[] = [];

    if (!version) {
      issues.push('Not Aurora MySQL');
    } else {
      successes.push('Aurora MySQL detected');
    }

    if (DB_HOST?.includes('cluster-ro-')) {
      issues.push('Using READER endpoint (should use Writer)');
    } else if (DB_HOST?.includes('cluster-')) {
      successes.push('Using cluster endpoint');
    }

    if (procRows.length === 0) {
      issues.push('Procedure mysql.rds_add_s3_integration_role NOT found');
    } else {
      successes.push('Procedure exists');
    }

    if (successes.length > 0) {
      console.log('✅ Working:');
      successes.forEach(s => console.log(`   - ${s}`));
      console.log('');
    }

    if (issues.length > 0) {
      console.log('❌ Issues Found:');
      issues.forEach(i => console.log(`   - ${i}`));
      console.log('');
    }

    // RECOMMENDATIONS
    console.log('🔧 RECOMMENDATIONS:\n');
    
    if (procRows.length === 0) {
      console.log('⚠️  MAIN ISSUE: Procedure not available');
      console.log('');
      console.log('📋 Steps to Fix:');
      console.log('');
      console.log('1️⃣  RDS Console Check:');
      console.log('   - Go to Aurora cluster (not instance)');
      console.log('   - Connectivity & security tab');
      console.log('   - Manage IAM roles section');
      console.log('   - Check "Feature" dropdown when adding role');
      console.log('   - MUST select: "s3Import" (or "S3_INTEGRATION")');
      console.log('');
      console.log('2️⃣  Remove & Re-attach Role:');
      console.log('   - Delete current role');
      console.log('   - Wait 2-3 minutes');
      console.log('   - Add role again');
      console.log('   - Feature: Select "s3Import"');
      console.log('   - Role: AuroraS3AccessRole');
      console.log('   - Apply immediately');
      console.log('   - Wait 10-15 minutes');
      console.log('');
      console.log('3️⃣  Cluster Restart (if above doesn\'t work):');
      console.log('   - RDS Console → Cluster → Actions → Reboot');
      console.log('   - Wait for reboot to complete');
      console.log('   - Then check procedure again');
      console.log('');
      console.log('4️⃣  Alternative: Check if role needs different ARN format');
      console.log('   - IAM Console → Roles → AuroraS3AccessRole');
      console.log('   - Copy full ARN');
      console.log('   - Verify trust relationship allows RDS service');
      console.log('');
    } else {
      console.log('✅ Procedure exists! Enable S3:');
      console.log('   npm run enable-s3-terminal\n');
    }

    console.log('🔄 After fixing, re-run:');
    console.log('   npm run check-s3-procedure\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Check .env file has correct credentials');
    console.error('   - Verify Aurora cluster status is "Available"');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

diagnoseS3Issue();


