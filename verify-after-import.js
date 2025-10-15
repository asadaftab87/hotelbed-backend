const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '54.85.142.212',
      user: 'asadaftab',
      password: 'Asad124@',
      database: 'hotelbed'
    });

    console.log('\n🔍 POST-IMPORT VERIFICATION\n');
    console.log('═'.repeat(90));

    // 1. Cost Table
    console.log('\n📊 COST TABLE:\n');
    const [costStats] = await conn.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN amount IS NOT NULL THEN 1 ELSE 0 END) as with_price,
        SUM(CASE WHEN boardCode IS NOT NULL THEN 1 ELSE 0 END) as with_board,
        ROUND(AVG(CASE WHEN amount IS NOT NULL THEN amount ELSE NULL END), 2) as avg_price
      FROM Cost
    `);
    
    const costResult = costStats[0];
    console.log(`   Total records:     ${costResult.total}`);
    console.log(`   With prices:       ${costResult.with_price} ${costResult.with_price > 0 ? '✅' : '❌'}`);
    console.log(`   With board codes:  ${costResult.with_board} ${costResult.with_board > 0 ? '✅' : '❌'}`);
    console.log(`   Average price:     €${costResult.avg_price || 0}`);
    
    if (costResult.with_price > 0) {
      const [costSamples] = await conn.execute(`
        SELECT amount, boardCode, roomCode 
        FROM Cost 
        WHERE amount IS NOT NULL 
        LIMIT 3
      `);
      console.log('\n   Sample data:');
      costSamples.forEach((row, i) => {
        console.log(`   ${i+1}. Amount: €${row.amount}, Board: ${row.boardCode}, Room: ${row.roomCode}`);
      });
    }

    // 2. MinMaxStay Table
    console.log('\n\n📊 MINMAXSTAY TABLE:\n');
    const [stayStats] = await conn.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN startDate IS NOT NULL THEN 1 ELSE 0 END) as with_date,
        SUM(CASE WHEN minNights IS NOT NULL THEN 1 ELSE 0 END) as with_nights,
        SUM(CASE WHEN monFlag IS NOT NULL THEN 1 ELSE 0 END) as with_flags
      FROM MinMaxStay
    `);
    
    const stayResult = stayStats[0];
    console.log(`   Total records:     ${stayResult.total}`);
    console.log(`   With dates:        ${stayResult.with_date} ${stayResult.with_date > 0 ? '✅' : '❌'}`);
    console.log(`   With night limits: ${stayResult.with_nights} ${stayResult.with_nights > 0 ? '✅' : '❌'}`);
    console.log(`   With day flags:    ${stayResult.with_flags} ${stayResult.with_flags > 0 ? '✅' : '❌'}`);
    
    if (stayResult.with_date > 0) {
      const [staySamples] = await conn.execute(`
        SELECT startDate, roomCode, minNights, maxNights 
        FROM MinMaxStay 
        WHERE startDate IS NOT NULL 
        LIMIT 3
      `);
      console.log('\n   Sample data:');
      staySamples.forEach((row, i) => {
        const date = row.startDate ? row.startDate.toISOString().split('T')[0] : 'NULL';
        console.log(`   ${i+1}. Date: ${date}, Room: ${row.roomCode}, Min: ${row.minNights}, Max: ${row.maxNights}`);
      });
    }

    // 3. CancellationFee Table
    console.log('\n\n📊 CANCELLATIONFEE TABLE:\n');
    const [feeStats] = await conn.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN startDate IS NOT NULL THEN 1 ELSE 0 END) as with_date,
        SUM(CASE WHEN amountFrom IS NOT NULL THEN 1 ELSE 0 END) as with_amount,
        SUM(CASE WHEN languageCode IS NOT NULL THEN 1 ELSE 0 END) as with_lang
      FROM CancellationFee
    `);
    
    const feeResult = feeStats[0];
    console.log(`   Total records:     ${feeResult.total}`);
    console.log(`   With dates:        ${feeResult.with_date} ${feeResult.with_date > 0 ? '✅' : '❌'}`);
    console.log(`   With amounts:      ${feeResult.with_amount} ${feeResult.with_amount > 0 ? '✅' : '❌'}`);
    console.log(`   With language:     ${feeResult.with_lang} ${feeResult.with_lang > 0 ? '✅' : '❌'}`);
    
    if (feeResult.with_date > 0) {
      const [feeSamples] = await conn.execute(`
        SELECT startDate, amount, amountFrom, languageCode 
        FROM CancellationFee 
        WHERE startDate IS NOT NULL 
        LIMIT 3
      `);
      console.log('\n   Sample data:');
      feeSamples.forEach((row, i) => {
        const date = row.startDate ? row.startDate.toISOString().split('T')[0] : 'NULL';
        console.log(`   ${i+1}. Date: ${date}, Amount: €${row.amount}, AmountFrom: €${row.amountFrom || 0}, Lang: ${row.languageCode || 'NULL'}`);
      });
    }

    // 4. Other Important Tables
    console.log('\n\n📊 OTHER TABLES:\n');
    
    const tables = ['Contract', 'Room', 'Supplement', 'Inventory'];
    for (const table of tables) {
      const [count] = await conn.execute(`SELECT COUNT(*) as total FROM ${table}`);
      const total = count[0].total;
      console.log(`   ${table.padEnd(20)} ${total.toString().padStart(8)} records ${total > 0 ? '✅' : '❌'}`);
    }

    // 5. Generated Tables
    console.log('\n\n📊 GENERATED TABLES:\n');
    
    const [priceCount] = await conn.execute(`SELECT COUNT(*) as total FROM CheapestPricePerPerson`);
    const [indexCount] = await conn.execute(`SELECT COUNT(*) as total FROM SearchIndex`);
    
    console.log(`   CheapestPricePerPerson ${priceCount[0].total.toString().padStart(8)} records ${priceCount[0].total > 0 ? '✅' : '❌'}`);
    console.log(`   SearchIndex            ${indexCount[0].total.toString().padStart(8)} records ${indexCount[0].total > 0 ? '✅' : '❌'}`);

    // 6. Final Verdict
    console.log('\n' + '═'.repeat(90));
    console.log('\n🎯 VERIFICATION RESULT:\n');
    
    const allGood = 
      costResult.with_price > 0 &&
      costResult.with_board > 0 &&
      stayResult.with_date > 0 &&
      stayResult.with_nights > 0 &&
      feeResult.with_date > 0 &&
      feeResult.with_amount > 0;
    
    if (allGood) {
      console.log('✅ ✅ ✅ ALL FIXES SUCCESSFULLY APPLIED! ✅ ✅ ✅\n');
      console.log('   Cost table has prices          ✅');
      console.log('   MinMaxStay has correct fields  ✅');
      console.log('   CancellationFee has new fields ✅');
      console.log('\n🚀 Ready to test APIs!\n');
    } else {
      console.log('⚠️  SOME ISSUES DETECTED:\n');
      if (costResult.with_price === 0) console.log('   ❌ Cost table still has NULL prices');
      if (stayResult.with_date === 0) console.log('   ❌ MinMaxStay still has wrong field mapping');
      if (feeResult.with_date === 0) console.log('   ❌ CancellationFee still has wrong field mapping');
      console.log('\n📝 Re-run the import process!\n');
    }

    await conn.end();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
})();

