import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function enableS3Terminal() {
  console.log('\n' + '='.repeat(80));
  console.log('🔐 ENABLING S3 INTEGRATION VIA TERMINAL');
  console.log('='.repeat(80) + '\n');

  const DB_HOST = process.env.DB_HOST;
  const DB_USER = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD;
  const DB_NAME = process.env.DB_NAME;
  const IAM_ROLE_ARN = 'arn:aws:iam::357058555433:role/AuroraS3AccessRole';

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

    // Step 1: Check Aurora
    console.log('🔍 Step 1: Verifying Aurora MySQL...');
    const [versionRows]: any = await connection.query('SELECT @@aurora_version as version');
    const version = versionRows[0]?.version;
    
    if (version) {
      console.log(`✅ Aurora MySQL: Version ${version}\n`);
    } else {
      console.log('⚠️  Warning: This might not be Aurora MySQL\n');
    }

    // Step 2: Check if procedure exists
    console.log('🔍 Step 2: Checking if procedure exists...');
    const [procRows]: any = await connection.query(
      `SELECT ROUTINE_NAME 
       FROM information_schema.ROUTINES 
       WHERE ROUTINE_SCHEMA = 'mysql' 
       AND ROUTINE_NAME = 'rds_add_s3_integration_role'`
    );

    if (procRows.length === 0) {
      console.log('❌ Procedure mysql.rds_add_s3_integration_role does NOT exist\n');
      console.log('📋 Possible reasons:');
      console.log('   1. IAM role not attached to cluster (check RDS Console)');
      console.log('   2. Role attached but procedure not loaded yet (wait 10-15 min)');
      console.log('   3. Wrong Aurora version or endpoint\n');
      console.log('🔧 Solutions:');
      console.log('   - Check RDS Console → IAM roles → Status should be "Active"');
      console.log('   - Wait 10-15 minutes after role attachment');
      console.log('   - Verify using Writer endpoint (not Reader)\n');
      
      // Check available procedures
      console.log('🔍 Checking available S3-related procedures...');
      const [allProcRows]: any = await connection.query(
        `SELECT ROUTINE_NAME 
         FROM information_schema.ROUTINES 
         WHERE ROUTINE_SCHEMA = 'mysql' 
         AND ROUTINE_NAME LIKE '%s3%'`
      );
      
      if (allProcRows.length > 0) {
        console.log('   Available S3 procedures:');
        allProcRows.forEach((row: any) => {
          console.log(`   - ${row.ROUTINE_NAME}`);
        });
      } else {
        console.log('   No S3-related procedures found');
      }
      console.log('');
      
      process.exit(1);
    }

    console.log('✅ Procedure exists!\n');

    // Step 3: Enable S3 Integration
    console.log('🔐 Step 3: Enabling S3 Integration...');
    console.log(`   IAM Role: ${IAM_ROLE_ARN}`);

    try {
      await connection.query(
        `CALL mysql.rds_add_s3_integration_role(?)`,
        [IAM_ROLE_ARN]
      );
      console.log('✅ S3 integration role added successfully!\n');
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      if (error.message.includes('already')) {
        console.log('ℹ️  Role already added (this is OK)');
      } else {
        throw error;
      }
    }

    // Step 4: Verify
    console.log('🔍 Step 4: Verifying S3 Integration...');
    const [s3Rows]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration');
    
    if (s3Rows.length > 0) {
      console.log('✅ S3 Integration verified!\n');
      console.log('Current S3 Integration Roles:');
      console.table(s3Rows);
    } else {
      console.log('⚠️  S3 integration table is empty');
      console.log('   This might indicate an issue');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ S3 INTEGRATION ENABLED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('\n📋 Next Steps:');
    console.log('   1. Test connection: npm run test-s3-aurora');
    console.log('   2. Run import: curl http://localhost:5000/api/hotelbed/process');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Check .env file has correct credentials');
    console.error('   - Verify Aurora cluster status is "Available"');
    console.error('   - Check username/password are correct');
    console.error('   - Ensure IAM role is attached to cluster');
    console.error('   - Verify using Writer endpoint (not Reader)');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

enableS3Terminal();


