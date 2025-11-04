const fs = require('fs');

const ghotPath = 'downloads/hotelbed_cache_full_1762202520003/GENERAL/GHOT_F';
const content = fs.readFileSync(ghotPath, 'utf8');
const lines = content.split('\n').filter(l => l && !l.startsWith('{'));

console.log(`Total lines: ${lines.length}`);
console.log('\nFirst 5 hotels:');

for (let i = 0; i < Math.min(5, lines.length); i++) {
  const parts = lines[i].split(':');
  const id = parts[0];
  const name = parts[12] ? parts[12].trim() : `Property ${id}`;
  console.log(`ID: ${id}, Name: ${name}`);
}
