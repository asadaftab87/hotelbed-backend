import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function enableS3Integration() {
  console.log('\n' + '='.repeat(80));
  console.log('🔐 ENABLING S3 INTEGRATION IN AURORA');
  console.log('='.repeat(80) + '\n');

  const DB_HOST = process.env.DB_HOST;
  const DB_USER = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD;
  const DB_NAME = process.env.DB_NAME;
  const IAM_ROLE_ARN = 'arn:aws:iam::357058555433:role/AuroraS3AccessRole';

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error('❌ Missing database credentials in .env file');
    console.error('   Required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   Host: ${DB_HOST}`);
  console.log(`   User: ${DB_USER}`);
  console.log(`   Database: ${DB_NAME}`);
  console.log(`   IAM Role: ${IAM_ROLE_ARN}`);
  console.log('');

  let connection: mysql.Connection | null = null;

  try {
    // Step 1: Connect to database
    console.log('🔌 Connecting to Aurora...');
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });
    console.log('✅ Connected successfully!\n');

    // Step 2: Verify Aurora MySQL
    console.log('🔍 Step 1: Verifying Aurora MySQL...');
    const [versionRows]: any = await connection.query('SELECT @@aurora_version as version');
    const version = versionRows[0]?.version;

    if (version) {
      console.log(`✅ Aurora MySQL detected: Version ${version}\n`);
    } else {
      console.log('⚠️  Warning: This might not be Aurora MySQL');
      console.log('   S3 integration may not work\n');
    }

    // Step 3: Enable S3 Integration
    console.log('🔐 Step 2: Enabling S3 Integration...');
    console.log(`   Adding IAM role: ${IAM_ROLE_ARN}`);

    try {
      await connection.query(
        `CALL mysql.rds_add_s3_integration_role(?)`,
        [IAM_ROLE_ARN]
      );
      console.log('✅ S3 integration role added successfully!\n');
    } catch (error: any) {
      if (error.message.includes('does not exist')) {
        console.error('❌ Error: Procedure mysql.rds_add_s3_integration_role does not exist');
        console.error('\n⚠️  Possible issues:');
        console.error('   1. IAM role not attached to cluster (check RDS Console)');
        console.error('   2. Wait 5-10 minutes after attaching role');
        console.error('   3. Wrong endpoint (use Writer endpoint, not Reader)');
        process.exit(1);
      } else {
        throw error;
      }
    }

    // Step 4: Verify S3 Integration
    console.log('🔍 Step 3: Verifying S3 Integration...');
    try {
      const [s3Rows]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration');
      console.log('✅ S3 Integration verified!\n');
      console.log('Current S3 Integration Roles:');
      console.table(s3Rows);
    } catch (error: any) {
      if (error.message.includes("doesn't exist")) {
        console.log('⚠️  Table mysql.aws_s3_integration doesn\'t exist yet');
        console.log('   This is normal - it will be created automatically');
        console.log('   Wait a few minutes and retry verification\n');
      } else {
        console.log('⚠️  Could not verify:', error.message);
      }
    }

    console.log('='.repeat(80));
    console.log('✅ S3 INTEGRATION ENABLED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('\n📋 Next Steps:');
    console.log('   1. Run verification: npm run verify-aurora');
    console.log('   2. Start app: npm run dev');
    console.log('   3. Test import: curl http://localhost:5000/api/hotelbed/process');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Check .env file has correct credentials');
    console.error('   - Verify Aurora cluster status is "Available"');
    console.error('   - Check username/password are correct');
    console.error('   - Ensure IAM role is attached to cluster');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

enableS3Integration();

