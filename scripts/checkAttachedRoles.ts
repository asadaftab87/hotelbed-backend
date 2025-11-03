import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Check what IAM roles are actually attached and try to enable S3
 */

async function checkAttachedRoles() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CHECKING ATTACHED IAM ROLES & S3 VARIABLES');
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

    // Check S3 variables
    console.log('1️⃣  CHECKING S3 VARIABLES...\n');
    const [varRows]: any = await connection.query(
      `SHOW VARIABLES WHERE Variable_name IN ('aurora_load_from_s3_role', 'aws_default_s3_role')`
    );
    
    console.table(varRows);
    
    const auroraRole = varRows.find((v: any) => v.Variable_name === 'aurora_load_from_s3_role');
    const awsRole = varRows.find((v: any) => v.Variable_name === 'aws_default_s3_role');
    
    if (auroraRole && auroraRole.Value && auroraRole.Value.trim() !== '') {
      console.log('   ✅ aurora_load_from_s3_role is SET!\n');
      console.log(`   Value: ${auroraRole.Value}\n`);
    } else {
      console.log('   ❌ aurora_load_from_s3_role is EMPTY\n');
    }
    
    if (awsRole && awsRole.Value && awsRole.Value.trim() !== '') {
      console.log('   ✅ aws_default_s3_role is SET!\n');
      console.log(`   Value: ${awsRole.Value}\n`);
    } else {
      console.log('   ❌ aws_default_s3_role is EMPTY\n');
    }

    // Check procedure
    console.log('2️⃣  CHECKING PROCEDURE...\n');
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
      console.log('   ❌ Procedure still NOT found\n');
      
      // Try to check aws_s3_integration table
      console.log('3️⃣  CHECKING S3 INTEGRATION TABLE...\n');
      try {
        const [s3Rows]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration');
        if (s3Rows.length > 0) {
          console.log('   ✅ Table exists and has entries:\n');
          console.table(s3Rows);
          console.log('\n   ⚠️  Table has data but variables are empty!');
          console.log('   This might mean role is set but not active.\n');
        } else {
          console.log('   ⚠️  Table exists but is empty\n');
        }
      } catch (tableError: any) {
        console.log(`   ❌ Table error: ${tableError.message}\n`);
      }
    }

    // Recommendation
    console.log('='.repeat(80));
    console.log('📋 RECOMMENDATION:\n');
    
    if (procRows.length === 0) {
      console.log('⚠️  Procedure still not available after service connect + reboot.\n');
      console.log('🔧 Next Steps:\n');
      console.log('1. RDS Console → Check "Current IAM roles" section');
      console.log('   - Kya role dikh raha hai?');
      console.log('   - Role ARN kya hai?');
      console.log('   - Feature name kya hai?\n');
      console.log('2. Agar auto-created role hai:');
      console.log('   - Us role ka ARN copy karo');
      console.log('   - Agar procedure available ho, to us ARN se enable karo\n');
      console.log('3. OR: Manual AuroraS3AccessRole attach:');
      console.log('   - Remove current role');
      console.log('   - "Select IAM roles to add" → AuroraS3AccessRole');
      console.log('   - Reboot again\n');
      console.log('4. Alternative: AWS Support ticket\n');
    } else if (auroraRole && auroraRole.Value && auroraRole.Value.trim() !== '') {
      console.log('✅ S3 variables are SET!');
      console.log('   You might be able to use LOAD DATA FROM S3 directly!\n');
      console.log('   Test: npm run test-s3-aurora\n');
    } else {
      console.log('⚠️  Variables empty, need to enable S3 integration.\n');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAttachedRoles();


