/**
 * Download Full ZIP from Hotelbeds
 * This will download complete data including CONTRACT folder
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const BASE_URL = 'https://aif2.hotelbeds.com/aif2-pub-ws/files';
const API_KEY = 'f513d78a7046ca883c02bd80926aa1b7';

async function downloadFullZip() {
  console.log('🚀 Downloading Full ZIP from Hotelbeds...\n');

  const url = `${BASE_URL}/full`;
  const headers = { 'Api-Key': API_KEY };

  try {
    const response = await axios.get(url, {
      headers,
      responseType: 'stream',
      timeout: 0,
    });

    const version = response.headers['x-version'] || Date.now().toString();
    const totalLength = parseInt(response.headers['content-length'] || '0', 10);
    const totalMB = (totalLength / (1024 * 1024)).toFixed(2);

    console.log(`📦 Total Size: ${totalMB} MB`);
    console.log(`📌 Version: ${version}\n`);

    const zipPath = path.join(__dirname, `downloads/hotelbeds_full_${version}.zip`);
    const extractPath = path.join(__dirname, `downloads/fullrates_v1`);

    // Create downloads directory
    await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

    const writer = fs.createWriteStream(zipPath);
    let downloaded = 0;
    let lastLog = 0;

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      const now = Date.now();

      // Log every 2 seconds
      if (now - lastLog > 2000 || downloaded >= totalLength) {
        const percent = totalLength ? ((downloaded / totalLength) * 100).toFixed(1) : '?';
        const mb = (downloaded / (1024 * 1024)).toFixed(2);
        process.stdout.write(`\r📥 Downloaded: ${mb} MB (${percent}%)  `);
        lastLog = now;
      }
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log('\n✅ Download complete!\n');

    console.log('📂 Extracting ZIP...');
    
    // Delete old extraction if exists
    if (fs.existsSync(extractPath)) {
      console.log('🗑️  Removing old extraction...');
      await fs.promises.rm(extractPath, { recursive: true, force: true });
    }

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    console.log(`✅ Extracted to: ${extractPath}\n`);

    // Verify extraction
    const contractDir = path.join(extractPath, 'fullrates_v1', 'CONTRACT');
    const generalDir = path.join(extractPath, 'fullrates_v1', 'GENERAL');

    if (fs.existsSync(contractDir)) {
      const contractFiles = fs.readdirSync(contractDir).filter(f => f.startsWith('C'));
      console.log(`✅ CONTRACT folder: ${contractFiles.length} files`);
    } else {
      console.log('❌ CONTRACT folder NOT FOUND!');
    }

    if (fs.existsSync(generalDir)) {
      const generalFiles = fs.readdirSync(generalDir);
      console.log(`✅ GENERAL folder: ${generalFiles.length} files`);
    } else {
      console.log('❌ GENERAL folder NOT FOUND!');
    }

    console.log('\n🎉 Ready to process!');
    console.log('💡 Now run: GET http://localhost:5000/api/v1/hotelbed\n');

    // Clean up ZIP
    console.log('🗑️  Cleaning up ZIP file...');
    await fs.promises.unlink(zipPath);
    console.log('✅ Cleanup complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
}

downloadFullZip();

