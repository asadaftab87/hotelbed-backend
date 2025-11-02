import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function createDatabase() {
  console.log('\n' + '='.repeat(80));
  console.log('🗄️  CREATING AURORA DATABASE');
  console.log('='.repeat(80) + '\n');

  // Connect without specifying database
  let connection: mysql.Connection | null = null;

  try {
    console.log('🔌 Connecting to Aurora...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      // Don't specify database - we're creating it
    });

    console.log('✅ Connected successfully!\n');

    // Check if database exists
    console.log('🔍 Checking if database exists...');
    const [databases]: any = await connection.query(
      `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [process.env.DB_NAME]
    );

    if (databases.length > 0) {
      console.log(`✅ Database '${process.env.DB_NAME}' already exists!`);
    } else {
      console.log(`📝 Creating database '${process.env.DB_NAME}'...`);
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
      console.log(`✅ Database '${process.env.DB_NAME}' created successfully!`);
    }

    // Switch to database
    await connection.query(`USE ${process.env.DB_NAME}`);
    console.log(`✅ Using database: ${process.env.DB_NAME}\n`);

    // Verify Aurora version
    console.log('🔍 Verifying Aurora...');
    const [versionRows]: any = await connection.query('SELECT @@aurora_version as version');
    const version = versionRows[0]?.version;

    if (version) {
      console.log(`✅ Aurora MySQL detected: Version ${version}\n`);
    } else {
      console.log('⚠️  Warning: This might not be Aurora MySQL');
      console.log('   S3 integration may not work\n');
    }

    console.log('='.repeat(80));
    console.log('✅ DATABASE CREATION COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📋 Next Steps:');
    console.log('   1. Create tables: npm run create-tables');
    console.log('   2. Run verification: npm run verify-aurora');
    console.log('   3. Start app: npm run dev\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Check .env file has correct credentials');
    console.error('   - Verify Aurora cluster status is "Available"');
    console.error('   - Check username/password are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createDatabase();

