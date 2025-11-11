#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const ratesFile = path.join(__dirname, 'downloads/csv_output/hotel_rates.csv');

async function analyze() {
  const stream = fs.createReadStream(ratesFile);
  const rl = readline.createInterface({ input: stream });
  
  const hotelCounts = new Map();
  let total = 0;
  let isFirst = true;
  
  console.log('📊 Analyzing hotel_rates.csv...\n');
  
  for await (const line of rl) {
    if (isFirst) { isFirst = false; continue; }
    
    const hotelId = line.split(',')[0];
    hotelCounts.set(hotelId, (hotelCounts.get(hotelId) || 0) + 1);
    
    total++;
    if (total % 1000000 === 0) {
      process.stdout.write(`\r   Processed: ${(total/1000000).toFixed(1)}M records...`);
    }
  }
  
  console.log(`\n\n✅ Analysis complete!\n`);
  console.log(`Total rate records: ${total.toLocaleString()}`);
  console.log(`Unique hotels: ${hotelCounts.size.toLocaleString()}`);
  console.log(`Average rates per hotel: ${Math.round(total/hotelCounts.size).toLocaleString()}\n`);
  
  // Top 10 hotels by rate count
  const sorted = [...hotelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log('Top 10 hotels by rate count:');
  sorted.forEach(([id, count]) => {
    console.log(`   Hotel ${id}: ${count.toLocaleString()} rates`);
  });
  
  // Check test hotels
  console.log('\nTest hotels:');
  [14126, 87607, 96763, 371129].forEach(id => {
    const count = hotelCounts.get(id.toString()) || 0;
    console.log(`   Hotel ${id}: ${count.toLocaleString()} rates`);
  });
}

analyze().catch(console.error);
