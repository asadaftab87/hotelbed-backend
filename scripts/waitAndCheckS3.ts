import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Wait and check S3 procedure after reboot
 */

async function waitAndCheckS3() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CHECKING S3 PROCEDURE AFTER REBOOT');
  console.log('='.repeat(80) + '\n');

  const DB_HOST = process.env.DB_HOST;
  const DB_USER = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD;
  const DB_NAME = process.env.DB_NAME;
  const IAM_ROLE_ARN = 'arn:aws:iam::357058555433:role/AuroraS3AccessRole';

  let connection: mysql.Connection | null = null;

  try {
    console.log('🔌 Connecting to Aurora (after reboot)...');
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      connectTimeout: 10000,
    });
    console.log('✅ Connected successfully!\n');

    // Check 1: Procedure exists?
    console.log('1️⃣  CHECKING PROCEDURE...');
    const [procRows]: any = await connection.query(
      `SELECT ROUTINE_NAME 
       FROM information_schema.ROUTINES 
       WHERE ROUTINE_SCHEMA = 'mysql' 
       AND ROUTINE_NAME = 'rds_add_s3_integration_role'`
    );

    if (procRows.length > 0) {
      console.log('   ✅ Procedure EXISTS!\n');
      
      // Check 2: S3 Variables
      console.log('2️⃣  CHECKING S3 VARIABLES...');
      const [varRows]: any = await connection.query(
        `SHOW VARIABLES WHERE Variable_name IN ('aurora_load_from_s3_role', 'aws_default_s3_role')`
      );
      
      console.table(varRows);
      
      const auroraRole = varRows.find((v: any) => v.Variable_name === 'aurora_load_from_s3_role');
      const awsRole = varRows.find((v: any) => v.Variable_name === 'aws_default_s3_role');
      
      if (auroraRole && auroraRole.Value && auroraRole.Value.trim() !== '') {
        console.log('   ✅ aurora_load_from_s3_role is SET!\n');
      } else {
        console.log('   ⚠️  aurora_load_from_s3_role is EMPTY (need to enable)\n');
      }
      
      if (awsRole && awsRole.Value && awsRole.Value.trim() !== '') {
        console.log('   ✅ aws_default_s3_role is SET!\n');
      } else {
        console.log('   ⚠️  aws_default_s3_role is EMPTY (need to enable)\n');
      }

      // Step 3: Enable S3
      console.log('3️⃣  ENABLING S3 INTEGRATION...');
      console.log(`   IAM Role: ${IAM_ROLE_ARN}\n`);

      try {
        await connection.query(
          `CALL mysql.rds_add_s3_integration_role(?)`,
          [IAM_ROLE_ARN]
        );
        console.log('   ✅ S3 integration role added successfully!\n');
      } catch (error: any) {
        if (error.message.includes('already')) {
          console.log('   ℹ️  Role already added (OK)\n');
        } else {
          console.error(`   ❌ Error: ${error.message}\n`);
          throw error;
        }
      }

      // Step 4: Verify
      console.log('4️⃣  VERIFYING S3 INTEGRATION...');
      try {
        const [s3Rows]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration');
        
        if (s3Rows.length > 0) {
          console.log('   ✅ S3 Integration verified!\n');
          console.table(s3Rows);
          
          // Check variables again
          const [finalVars]: any = await connection.query(
            `SHOW VARIABLES WHERE Variable_name IN ('aurora_load_from_s3_role', 'aws_default_s3_role')`
          );
          console.log('\n   Final S3 Variables:');
          console.table(finalVars);
          
          console.log('\n' + '='.repeat(80));
          console.log('✅ SUCCESS! S3 INTEGRATION IS NOW ENABLED!');
          console.log('='.repeat(80));
          console.log('\n📋 Next Steps:');
          console.log('   1. Test: npm run test-s3-aurora');
          console.log('   2. Run import: curl http://localhost:5000/api/v1/hotelbed/process\n');
        } else {
          console.log('   ⚠️  Table exists but is empty\n');
        }
      } catch (verifyError: any) {
        if (verifyError.message.includes("doesn't exist")) {
          console.log('   ⚠️  Table does not exist (might need more time)\n');
        } else {
          console.log(`   ⚠️  Error: ${verifyError.message}\n`);
        }
      }

    } else {
      console.log('   ❌ Procedure still NOT found\n');
      console.log('⚠️  ISSUE: Procedure not available after reboot\n');
      console.log('📋 Possible reasons:');
      console.log('   1. Instance reboot incomplete (wait 2-3 more minutes)');
      console.log('   2. IAM role not properly attached');
      console.log('   3. Need to remove and re-attach role\n');
      console.log('🔧 Solutions:');
      console.log('   - Wait 2-3 minutes and retry: npm run wait-check-s3');
      console.log('   - Or: RDS Console → Remove role → Re-attach → Reboot again\n');
      
      process.exit(1);
    }

  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.log('❌ Connection failed - Instance still rebooting?');
      console.log('   ⏳ Wait 2-3 more minutes and retry\n');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

waitAndCheckS3();


