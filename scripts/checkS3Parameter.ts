/**
 * Check S3 Role Parameter in Aurora
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

async function checkS3Parameter() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  });

  try {
    console.log('================================================================================');
    console.log('🔍 CHECKING S3 ROLE PARAMETER');
    console.log('================================================================================\n');

    console.log('1️⃣  Checking aws_default_s3_role parameter...');
    
    try {
      const [result] = await connection.query(`
        SELECT @@aws_default_s3_role AS role_arn
      `) as any;
      
      const roleArn = result[0]?.role_arn;
      console.log(`   Value: ${roleArn || 'NULL (NOT SET)'}\n`);
      
      if (!roleArn || roleArn === 'NULL') {
        console.log('❌ S3 role parameter is NOT SET!\n');
        console.log('This means the parameter group changes were not applied.');
        console.log('The cluster parameter group was modified, but Aurora didn\'t pick it up.\n');
        console.log('SOLUTION: Set it manually using rds_set_configuration procedure\n');
        
        console.log('2️⃣  Attempting to set via rds_set_configuration...');
        
        try {
          await connection.query(`
            CALL mysql.rds_set_configuration('aws_default_s3_role', 'arn:aws:iam::357058555433:role/AuroraS3AccessRole')
          `);
          console.log('   ✅ Set via procedure!\n');
          
          // Verify
          const [verifyResult] = await connection.query(`
            SELECT @@aws_default_s3_role AS role_arn
          `) as any;
          
          console.log(`   Verified: ${verifyResult[0]?.role_arn}\n`);
          console.log('✅ S3 ROLE IS NOW CONFIGURED!\n');
          console.log('Try the import now:');
          console.log('  curl -X POST http://localhost:5001/api/v1/hotelbed/upload-and-load\n');
          
        } catch (setProcErr: any) {
          console.log(`   ❌ Failed to set via procedure: ${setProcErr.message}\n`);
          console.log('This user may not have permission to call rds_set_configuration.\n');
        }
        
      } else {
        console.log('✅ S3 role parameter IS SET!\n');
        console.log(`   Role ARN: ${roleArn}\n`);
        console.log('The parameter is configured, but LOAD DATA might still fail.');
        console.log('This could mean:\n');
        console.log('1. IAM role lacks S3 permissions');
        console.log('2. S3 bucket path is wrong');
        console.log('3. Some other Aurora limitation\n');
      }
      
    } catch (err: any) {
      console.log(`   ❌ Error checking parameter: ${err.message}\n`);
    }
    
    console.log('3️⃣  Checking if we can list S3 configurations...');
    
    try {
      const [configs] = await connection.query(`
        CALL mysql.rds_show_configuration()
      `) as any;
      
      console.log('   Current RDS configurations:');
      console.log(configs);
      console.log('');
      
    } catch (err: any) {
      console.log(`   ⚠️  Could not list configurations: ${err.message}\n`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkS3Parameter();
