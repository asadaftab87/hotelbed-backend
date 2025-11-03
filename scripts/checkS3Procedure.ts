import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkS3Procedure() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CHECKING S3 PROCEDURE AVAILABILITY');
  console.log('='.repeat(80) + '\n');

  const DB_HOST = process.env.DB_HOST;
  const DB_USER = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD;
  const DB_NAME = process.env.DB_NAME;

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

    // Check all mysql procedures
    console.log('🔍 Checking all mysql procedures...');
    const [allProcs]: any = await connection.query(
      `SELECT ROUTINE_NAME 
       FROM information_schema.ROUTINES 
       WHERE ROUTINE_SCHEMA = 'mysql'
       ORDER BY ROUTINE_NAME`
    );

    console.log(`   Found ${allProcs.length} procedures in mysql database\n`);

    // Check for S3-related
    const s3Procs = allProcs.filter((p: any) => 
      p.ROUTINE_NAME.toLowerCase().includes('s3') || 
      p.ROUTINE_NAME.toLowerCase().includes('rds')
    );

    if (s3Procs.length > 0) {
      console.log('📋 S3/RDS related procedures:');
      s3Procs.forEach((proc: any) => {
        console.log(`   ✅ ${proc.ROUTINE_NAME}`);
      });
      console.log('');
    } else {
      console.log('⚠️  No S3/RDS related procedures found\n');
    }

    // Check specific procedure
    console.log('🔍 Checking for mysql.rds_add_s3_integration_role...');
    const [specificProc]: any = await connection.query(
      `SELECT ROUTINE_NAME 
       FROM information_schema.ROUTINES 
       WHERE ROUTINE_SCHEMA = 'mysql' 
       AND ROUTINE_NAME = 'rds_add_s3_integration_role'`
    );

    if (specificProc.length > 0) {
      console.log('✅ Procedure EXISTS!\n');
      console.log('🚀 You can now enable S3 integration:');
      console.log('   npm run enable-s3-terminal\n');
    } else {
      console.log('❌ Procedure does NOT exist (even after 3+ hours)\n');
      console.log('📋 Possible issues:');
      console.log('   1. IAM role not attached with correct feature (s3Import)');
      console.log('   2. Role attached to instance instead of cluster');
      console.log('   3. Wrong endpoint (using Reader instead of Writer)');
      console.log('   4. Cluster needs reboot/restart');
      console.log('   5. Aurora version compatibility issue\n');
      
      console.log('🔧 CRITICAL CHECKS:\n');
      console.log('1️⃣  RDS Console Verification:');
      console.log('   - Aurora cluster → Connectivity & security');
      console.log('   - Manage IAM roles section');
      console.log('   - Check:');
      console.log('      • Role: AuroraS3AccessRole');
      console.log('      • Status: Active (not Inactive)');
      console.log('      • Feature: s3Import (MUST be selected!)\n');
      
      console.log('2️⃣  Endpoint Check:');
      console.log(`   Current: ${DB_HOST}`);
      console.log('   Verify: Using CLUSTER Writer endpoint (not Reader)\n');
      
      console.log('3️⃣  Alternative: Try Direct LOAD DATA');
      console.log('   Sometimes LOAD DATA FROM S3 works even without procedure');
      console.log('   If IAM role is attached, it might work directly\n');
      
      console.log('🔍 Testing if LOAD DATA FROM S3 works without procedure...');
      
      // Try to test if it works anyway
      try {
        // Create a test table first
        await connection.query(`
          CREATE TABLE IF NOT EXISTS test_direct_s3 (
            id INT,
            name VARCHAR(100)
          )
        `);
        await connection.query('TRUNCATE TABLE test_direct_s3');
        
        // Try LOAD DATA - might work even without procedure
        const testS3Url = `s3://${process.env.AWS_S3_BUCKET}/hotelbed-csv/test_aurora_s3.csv`;
        await connection.query(`
          LOAD DATA FROM S3 '${testS3Url}'
          INTO TABLE test_direct_s3
          FIELDS TERMINATED BY ','
          ENCLOSED BY '"'
          LINES TERMINATED BY '\\n'
          IGNORE 1 ROWS
        `);
        
        console.log('✅ SUCCESS! LOAD DATA FROM S3 works without procedure!');
        console.log('   IAM role is working directly!\n');
        
        // Cleanup
        await connection.query('DROP TABLE test_direct_s3');
      } catch (testError: any) {
        console.log(`❌ LOAD DATA test failed: ${testError.message}`);
        if (testError.message.includes('aurora_load_from_s3_role') || 
            testError.message.includes('aws_default_s3_role')) {
          console.log('   This confirms S3 integration is NOT enabled\n');
        }
      }
      
      console.log('');
    }

    // Check Aurora version
    const [versionRows]: any = await connection.query('SELECT @@aurora_version as version');
    const version = versionRows[0]?.version;
    console.log(`🔍 Aurora Version: ${version || 'Not detected'}\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkS3Procedure();

