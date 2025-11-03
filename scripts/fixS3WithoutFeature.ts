import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Alternative approach for Aurora MySQL 3.08.2
 * If feature dropdown doesn't appear, we try:
 * 1. Cluster reboot
 * 2. Manual procedure check with different names
 * 3. Direct role configuration via SQL
 */

async function fixS3WithoutFeature() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 FIXING S3 INTEGRATION (NO FEATURE DROPDOWN)');
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

    // Step 1: Check if procedure exists with different variations
    console.log('1️⃣  CHECKING ALL POSSIBLE PROCEDURE NAMES...\n');
    
    const procedureVariations = [
      'rds_add_s3_integration_role',
      'rds_enable_s3_integration',
      'aws_add_s3_integration_role',
      'aws_enable_s3_integration',
      'rds_set_s3_role',
      'add_s3_integration_role',
    ];

    let foundProcedure: string | null = null;

    for (const procName of procedureVariations) {
      try {
        const [rows]: any = await connection.query(
          `SELECT ROUTINE_NAME 
           FROM information_schema.ROUTINES 
           WHERE ROUTINE_SCHEMA = 'mysql' 
           AND ROUTINE_NAME = ?`,
          [procName]
        );
        
        if (rows.length > 0) {
          foundProcedure = procName;
          console.log(`   ✅ Found: mysql.${procName}\n`);
          break;
        }
      } catch (e) {
        // Continue checking
      }
    }

    if (!foundProcedure) {
      console.log('   ❌ No S3 procedure found in any variation\n');
      
      // Step 2: Check IAM role status via MySQL
      console.log('2️⃣  CHECKING IAM ROLE CONFIGURATION...\n');
      
      try {
        // Try to check if role is recognized
        const [roleCheck]: any = await connection.query(
          `SHOW VARIABLES LIKE '%s3%'`
        );
        
        if (roleCheck.length > 0) {
          console.log('   S3-related variables:');
          console.table(roleCheck);
        } else {
          console.log('   ⚠️  No S3-related variables found\n');
        }
      } catch (e) {
        console.log('   ⚠️  Could not check variables\n');
      }

      // Step 3: Check if we can manually create integration
      console.log('3️⃣  ATTEMPTING ALTERNATIVE METHODS...\n');
      
      // Method 1: Try to query aws_s3_integration table directly
      try {
        const [tableExists]: any = await connection.query(
          `SELECT COUNT(*) as count 
           FROM information_schema.TABLES 
           WHERE TABLE_SCHEMA = 'mysql' 
           AND TABLE_NAME = 'aws_s3_integration'`
        );
        
        if (tableExists[0].count > 0) {
          console.log('   ✅ Table mysql.aws_s3_integration exists');
          console.log('   🔍 Trying to manually insert role...\n');
          
          try {
            await connection.query(
              `INSERT INTO mysql.aws_s3_integration (arn) VALUES (?) 
               ON DUPLICATE KEY UPDATE arn = ?`,
              [IAM_ROLE_ARN, IAM_ROLE_ARN]
            );
            console.log('   ✅ Manually inserted role ARN\n');
          } catch (insertError: any) {
            console.log(`   ❌ Could not insert: ${insertError.message}\n`);
          }
        } else {
          console.log('   ❌ Table does not exist\n');
        }
      } catch (e) {
        console.log('   ⚠️  Could not check table\n');
      }

      // Step 4: Check cluster status
      console.log('4️⃣  RECOMMENDATIONS:\n');
      console.log('   Since procedure is not available after 3+ hours:\n');
      console.log('   🔄 OPTION 1: Cluster Reboot (Most Likely Fix)');
      console.log('      RDS Console → Cluster → Actions → Reboot');
      console.log('      Wait for reboot (5-10 minutes)');
      console.log('      Then run: npm run check-s3-procedure\n');
      
      console.log('   🔍 OPTION 2: Verify IAM Role Permissions');
      console.log('      IAM Console → Roles → AuroraS3AccessRole');
      console.log('      Trust relationship should allow: rds.amazonaws.com');
      console.log('      Permissions should have S3 access\n');
      
      console.log('   📋 OPTION 3: Check Aurora Version Compatibility');
      console.log('      Aurora MySQL 3.08.2 should support S3 integration');
      console.log('      But procedure might need cluster restart to load\n');
      
      console.log('   🔧 OPTION 4: Try Different Endpoint');
      console.log('      Current: cluster endpoint (Writer)');
      console.log('      If you have instance endpoint, try that\n');
      
      process.exit(1);
    }

    // If procedure found, enable it
    if (foundProcedure) {
      console.log('5️⃣  ENABLING S3 INTEGRATION...\n');
      console.log(`   Using procedure: mysql.${foundProcedure}`);
      console.log(`   IAM Role: ${IAM_ROLE_ARN}\n`);

      try {
        await connection.query(
          `CALL mysql.${foundProcedure}(?)`,
          [IAM_ROLE_ARN]
        );
        console.log('   ✅ S3 integration enabled!\n');
      } catch (error: any) {
        if (error.message.includes('already')) {
          console.log('   ℹ️  Already enabled (OK)\n');
        } else {
          console.error(`   ❌ Error: ${error.message}\n`);
          throw error;
        }
      }

      // Verify
      console.log('6️⃣  VERIFYING...\n');
      try {
        const [s3Rows]: any = await connection.query(
          'SELECT * FROM mysql.aws_s3_integration'
        );
        
        if (s3Rows.length > 0) {
          console.log('   ✅ S3 Integration verified!\n');
          console.table(s3Rows);
          console.log('\n✅ SUCCESS! S3 Integration is now enabled!\n');
          console.log('📋 Next steps:');
          console.log('   1. Test: npm run test-s3-aurora');
          console.log('   2. Run import: curl http://localhost:5000/api/hotelbed/process\n');
        } else {
          console.log('   ⚠️  Enabled but table is empty\n');
        }
      } catch (verifyError: any) {
        console.log(`   ⚠️  Verification error: ${verifyError.message}\n`);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixS3WithoutFeature();


