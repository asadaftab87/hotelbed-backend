import pool from '@config/database';
import Logger from '@/core/Logger';

/**
 * Fix destination names - set name to code where it's empty/carriage return
 */
async function fixDestinationNames() {
  console.log('\n🔧 FIXING DESTINATION NAMES\n');
  console.log('═'.repeat(80));

  try {
    // Update destinations where name is empty, null, or contains only whitespace/carriage returns
    const query = `
      UPDATE destinations 
      SET name = code 
      WHERE name IS NULL 
         OR name = '' 
         OR name = '\r' 
         OR name = '\n'
         OR TRIM(name) = ''
    `;

    console.log('\n📝 Updating destinations where name is missing...');
    
    const [result]: any = await pool.query(query);
    
    console.log(`✅ Updated ${result.affectedRows} destinations\n`);

    // Verify the fix
    const [sample]: any = await pool.query(`
      SELECT code, country_code, name 
      FROM destinations 
      LIMIT 10
    `);

    console.log('📊 Sample destinations after fix:\n');
    sample.forEach((dest: any) => {
      console.log(`   ${dest.code} (${dest.country_code}): ${dest.name}`);
    });

    console.log('\n═'.repeat(80));
    console.log('✅ DESTINATION NAMES FIXED!\n');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fixDestinationNames();

