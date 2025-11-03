import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Find Aurora instances in the cluster
 * Helps identify which instance to reboot
 */

async function findAuroraInstances() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 FINDING AURORA INSTANCES');
  console.log('='.repeat(80) + '\n');

  const DB_HOST = process.env.DB_HOST;

  console.log('📋 Current Connection:');
  console.log(`   Host: ${DB_HOST}\n`);

  console.log('💡 To find instances:');
  console.log('   1. RDS Console → Databases');
  console.log('   2. Select cluster: hotelbed-aurora-cluster');
  console.log('   3. Click "Instances" tab (below cluster name)');
  console.log('   4. Look for instance with Role: "Writer"');
  console.log('   5. That\'s the one to reboot!\n');

  console.log('🔧 OR via AWS CLI:');
  console.log('   aws rds describe-db-clusters \\');
  console.log('     --db-cluster-identifier hotelbed-aurora-cluster \\');
  console.log('     --query \'DBClusterMembers[*].[DBInstanceIdentifier,IsClusterWriter]\' \\');
  console.log('     --output table\n');

  console.log('📝 Instance Format:');
  console.log('   Writer: hotelbed-aurora-cluster-instance-1');
  console.log('   Reader: hotelbed-aurora-cluster-instance-2 (if exists)\n');

  console.log('🚀 To reboot Writer instance:');
  console.log('   RDS Console → Select Writer instance → Actions → Reboot\n');
}

findAuroraInstances();


