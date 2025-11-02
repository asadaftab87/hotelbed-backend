import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testS3Direct() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING S3 DIRECT ACCESS (Without Procedure)');
  console.log('='.repeat(80) + '\n');

  const DB_HOST = process.env.DB_HOST;
  const DB_USER = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD;
  const DB_NAME = process.env.DB_NAME;

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error('❌ Missing database credentials in .env file');
    process.exit(1);
  }

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
    console.log('✅ Connected successfully!\n');

    // Check Aurora version
    const [versionRows]: any = await connection.query('SELECT @@aurora_version as version');
    const version = versionRows[0]?.version;
    console.log(`✅ Aurora MySQL: Version ${version}\n`);

    // Try to check if S3 integration table exists
    console.log('🔍 Checking S3 integration status...');
    try {
      const [s3Rows]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration');
      if (s3Rows.length > 0) {
        console.log('✅ S3 Integration Roles Found:');
        console.table(s3Rows);
      } else {
        console.log('⚠️  No S3 integration roles in table (table exists but empty)');
      }
    } catch (error: any) {
      if (error.message.includes("doesn't exist")) {
        console.log('ℹ️  S3 integration table doesn\'t exist yet');
        console.log('   This is normal - will be created when procedure is available\n');
      }
    }

    // Check if procedure exists
    console.log('🔍 Checking if procedure exists...');
    try {
      const [procRows]: any = await connection.query(
        `SELECT ROUTINE_NAME 
         FROM information_schema.ROUTINES 
         WHERE ROUTINE_SCHEMA = 'mysql' 
         AND ROUTINE_NAME = 'rds_add_s3_integration_role'`
      );
      
      if (procRows.length > 0) {
        console.log('✅ Procedure exists! Try: npm run enable-s3\n');
      } else {
        console.log('⚠️  Procedure not available yet');
        console.log('\n📋 Possible Solutions:');
        console.log('   1. Wait 10-15 minutes after IAM role attachment');
        console.log('   2. Verify role is attached with correct feature (s3Import)');
        console.log('   3. Try restarting Aurora cluster (if safe)');
        console.log('   4. Verify using Writer endpoint (not Reader)');
        console.log('\n✅ Good News: If role is attached, LOAD DATA FROM S3 might work directly!');
        console.log('   You can proceed with import - it will test during actual import.\n');
      }
    } catch (error: any) {
      console.log('⚠️  Could not check procedure:', error.message);
    }

    console.log('='.repeat(80));
    console.log('💡 RECOMMENDATION:');
    console.log('='.repeat(80));
    console.log('Since IAM role is attached and Active:');
    console.log('   1. Wait 10-15 more minutes');
    console.log('   2. Then retry: npm run enable-s3');
    console.log('   OR');
    console.log('   3. Proceed with import - S3 integration might work directly');
    console.log('      (LOAD DATA FROM S3 will use attached role automatically)');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testS3Direct();

