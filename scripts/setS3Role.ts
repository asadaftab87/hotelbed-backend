/**
 * Set Aurora S3 Integration Role via Database Parameter
 * This is the correct way for Aurora MySQL 3.x
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import Logger from '../src/core/Logger';

config();

async function setS3Role() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  });

  try {
    console.log('================================================================================');
    console.log('🔧 SETTING AURORA S3 INTEGRATION ROLE');
    console.log('================================================================================\n');

    const roleArn = 'arn:aws:iam::357058555433:role/AuroraS3AccessRole';

    console.log(`1️⃣  Setting aurora_load_from_s3_role parameter...`);
    
    // Set the S3 role for LOAD DATA FROM S3
    await connection.query(`
      SET GLOBAL aurora_load_from_s3_role = '${roleArn}'
    `);
    
    console.log('   ✅ aurora_load_from_s3_role set!\n');

    console.log(`2️⃣  Setting aws_default_s3_role parameter...`);
    
    // Set the default S3 role
    await connection.query(`
      SET GLOBAL aws_default_s3_role = '${roleArn}'
    `);
    
    console.log('   ✅ aws_default_s3_role set!\n');

    console.log(`3️⃣  Verifying settings...`);
    
    const [loadRole] = await connection.query(`
      SELECT @@aurora_load_from_s3_role AS role_arn
    `) as any;
    
    const [defaultRole] = await connection.query(`
      SELECT @@aws_default_s3_role AS role_arn
    `) as any;
    
    console.log(`   aurora_load_from_s3_role: ${loadRole[0]?.role_arn || 'NOT SET'}`);
    console.log(`   aws_default_s3_role: ${defaultRole[0]?.role_arn || 'NOT SET'}\n`);

    if (loadRole[0]?.role_arn && defaultRole[0]?.role_arn) {
      console.log('✅ S3 INTEGRATION CONFIGURED SUCCESSFULLY!\n');
      console.log('You can now use LOAD DATA FROM S3 commands.\n');
      console.log('Test with:');
      console.log('  npm run check-s3-procedure\n');
      console.log('Or load data with:');
      console.log('  curl -X POST http://localhost:5001/api/v1/hotelbed/upload-and-load\n');
    } else {
      console.log('❌ Failed to set S3 roles\n');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nThis might mean:');
    console.error('1. The IAM role is not attached to the cluster yet');
    console.error('2. The role ARN is incorrect');
    console.error('3. The user lacks SUPER privilege\n');
    console.error('Verify role is attached:');
    console.error('  aws rds describe-db-clusters --db-cluster-identifier hotelbed-aurora-cluster --query "DBClusters[0].AssociatedRoles"\n');
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setS3Role();
