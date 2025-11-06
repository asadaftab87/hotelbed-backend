import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@config/database';
import Logger from '@/core/Logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { env } from '@config/globals';
import AdmZip from 'adm-zip';
import { CSVGenerator } from '@/utils/csvGenerator';
import { S3Uploader } from '@/utils/s3Uploader';

export class HotelBedFileRepository {
  private readonly downloadsDir = path.join(process.cwd(), 'downloads');
  private readonly csvDir = path.join(process.cwd(), 'downloads', 'csv_output');
  private csvGenerator: CSVGenerator;
  private s3Uploader: S3Uploader;

  constructor() {
    this.csvGenerator = new CSVGenerator(this.csvDir);
    this.s3Uploader = new S3Uploader(
      process.env.AWS_S3_BUCKET || 'hotelbed-imports',
      'hotelbed-csv'
    );
  }

  // ============================================
  // DOWNLOAD METHODS (Same as before)
  // ============================================

  /**
   * Download HotelBed cache file with streaming support
   */
  async downloadCacheZip(): Promise<any> {
    const startTime = Date.now();

    try {
      if (!fs.existsSync(this.downloadsDir)) {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
      }

      const url = `${env.HOTELBEDS_BASE_URL}${env.HOTELBEDS_CACHE_ENDPOINT}`;
      const cacheType = env.HOTELBEDS_CACHE_TYPE;
      const fileName = `hotelbed_cache_${cacheType}_${Date.now()}.zip`;
      const filePath = path.join(this.downloadsDir, fileName);

      Logger.info('[DOWNLOAD] Starting HotelBeds cache download', { url, fileName });

      const response = await axios({
        method: 'GET',
        url,
        headers: { 'Api-key': env.HOTELBEDS_API_KEY },
        responseType: 'stream',
        timeout: 0,
      });

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      const totalMB = totalSize > 0 ? (totalSize / 1024 / 1024).toFixed(2) : 'Unknown';
      const writer = fs.createWriteStream(filePath);

      Logger.info(`[DOWNLOAD] Downloading ${totalMB} MB... (tracking progress)`);

      // Progress tracking
      let downloadedSize = 0;
      let lastLoggedMB = 0;
      const logInterval = 5; // Log every 5 MB

      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        const downloadedMB = downloadedSize / 1024 / 1024;
        
        // Log every 5 MB downloaded
        if (downloadedMB >= lastLoggedMB + logInterval) {
          const speedMBps = downloadedMB / ((Date.now() - startTime) / 1000);
          const percent = totalSize > 0 ? ((downloadedSize / totalSize) * 100).toFixed(1) : 'N/A';
          
          if (totalSize > 0) {
            Logger.info(`[DOWNLOAD] Progress: ${downloadedMB.toFixed(2)} MB / ${totalMB} MB (${percent}%) - Speed: ${speedMBps.toFixed(2)} MB/s`);
          } else {
            Logger.info(`[DOWNLOAD] Progress: ${downloadedMB.toFixed(2)} MB downloaded - Speed: ${speedMBps.toFixed(2)} MB/s`);
          }

          lastLoggedMB = Math.floor(downloadedMB / logInterval) * logInterval;
        }
      });

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => {
          const finalMB = (downloadedSize / 1024 / 1024).toFixed(2);
          Logger.info(`[DOWNLOAD] Download finished: ${finalMB} MB total downloaded`);
          resolve();
        });
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      Logger.info('[DOWNLOAD] Download completed', { fileName, duration: `${duration}s` });

      return {
        success: true,
        fileName,
        filePath,
        fileSizeMB: totalMB,
        duration: `${duration}s`,
      };
    } catch (error: any) {
      Logger.error('[DOWNLOAD] Download failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Download update data
   */
  async downloadUpdateZip(): Promise<any> {
    const startTime = Date.now();

    try {
      if (!fs.existsSync(this.downloadsDir)) {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
      }

      const url = `${env.HOTELBEDS_BASE_URL}${env.HOTELBEDS_UPDATE_ENDPOINT}`;
      const fileName = `hotelbed_update_${Date.now()}.zip`;
      const filePath = path.join(this.downloadsDir, fileName);

      Logger.info('[DOWNLOAD] Starting HotelBeds update download', { url, fileName });

      const response = await axios({
        method: 'GET',
        url,
        headers: { 'Api-key': env.HOTELBEDS_API_KEY },
        responseType: 'stream',
        timeout: 0,
      });

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      const totalMB = (totalSize / 1024 / 1024).toFixed(2);
      const writer = fs.createWriteStream(filePath);

      Logger.info(`[DOWNLOAD] Downloading ${totalMB} MB...`);

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      Logger.info('[DOWNLOAD] Update download completed', { fileName, duration: `${duration}s` });

      return {
        success: true,
        fileName,
        filePath,
        fileSizeMB: totalMB,
        duration: `${duration}s`,
      };
    } catch (error: any) {
      Logger.error('[DOWNLOAD] Update download failed', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // EXTRACT METHODS (Same as before)
  // ============================================

  /**
   * Extract ZIP file
   */
  async extractZipFile(zipFilePath: string): Promise<any> {
    const startTime = Date.now();

    try {
      const fileName = path.basename(zipFilePath, '.zip');
      const extractPath = path.join(this.downloadsDir, fileName);

      Logger.info('[EXTRACT] Starting ZIP extraction', { zipFilePath, extractPath });

      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(extractPath, true);

      const allFiles = this.getAllFiles(extractPath);
      const jsonFiles = allFiles.filter(f => f.endsWith('.json'));

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      Logger.info('[EXTRACT] Extraction completed', {
        totalFiles: allFiles.length,
        jsonFiles: jsonFiles.length,
        duration: `${duration}s`,
      });

      return {
        success: true,
        extractedPath: extractPath,
        totalFiles: allFiles.length,
        jsonFiles: jsonFiles.length,
        duration: `${duration}s`,
      };
    } catch (error: any) {
      Logger.error('[EXTRACT] Extraction failed', { error: error.message });
      throw error;
    }
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
        } else {
        arrayOfFiles.push(fullPath);
      }
    });

    return arrayOfFiles;
  }

  // ============================================
  // NEW CSV + S3 + LOAD DATA APPROACH
  // ============================================

  /**
   * Clean everything: downloads folder, database, and S3
   */
  async cleanEverything(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('🧹 CLEANING: Downloads → Database → S3');
    console.log('='.repeat(80));

    // Step 1: Clean downloads folder
    console.log('\n📁 Step 1/3: Cleaning downloads folder...');
    try {
      if (fs.existsSync(this.downloadsDir)) {
        fs.rmSync(this.downloadsDir, { recursive: true, force: true });
        fs.mkdirSync(this.downloadsDir, { recursive: true });
        console.log('   ✅ Downloads folder cleaned');
      } else {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
        console.log('   ✅ Downloads folder created');
      }
    } catch (error: any) {
      console.error('   ❌ Failed to clean downloads folder:', error.message);
      throw error;
    }

    // Step 2: Clean database
    console.log('\n🗄️  Step 2/3: Cleaning database...');
    try {
      await this.cleanDatabase();
      console.log('   ✅ Database cleaned');
    } catch (error: any) {
      console.error('   ❌ Failed to clean database:', error.message);
      throw error;
    }

    // Step 3: Clean S3 bucket
    console.log('\n☁️  Step 3/3: Cleaning S3 bucket...');
    try {
      await this.s3Uploader.cleanBucket();
      console.log('   ✅ S3 bucket cleaned');
    } catch (error: any) {
      console.error('   ❌ Failed to clean S3 bucket:', error.message);
      // Don't throw - S3 cleanup failure shouldn't stop the process
      console.log('   ⚠️  Continuing despite S3 cleanup error...');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANUP COMPLETE!');
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Clean database - truncate all tables
   */
  private async cleanDatabase(): Promise<void> {
    const connection = await pool.getConnection();

    try {
      // Disable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query('SET UNIQUE_CHECKS = 0');

      const tables = [
        // Hotel detail tables first (foreign keys)
        'hotel_tax_info',
        'hotel_pricing_rules',
        'hotel_room_features',
        'hotel_special_conditions',
        'hotel_cancellation_policies',
        'hotel_groups',
        'hotel_special_requests',
        'hotel_promotions',
        'hotel_configurations',
        'hotel_rate_tags',
        'hotel_email_settings',
        'hotel_occupancy_rules',
        'hotel_supplements',
        'hotel_rates',
        'hotel_inventory',
        'hotel_room_allocations',
        'hotel_contracts',
        // Core tables
        'hotels',
        'destinations',
        'chains',
        'categories',
        'api_metadata',
        'cheapest_pp',
        'search_index',
        // System tables
        'import_logs',
        'processing_queue',
      ];

      // Truncate all tables in parallel
      const truncatePromises = tables.map(async (table) => {
        try {
          await connection.query(`TRUNCATE TABLE \`${table}\``);
          return { table, success: true };
    } catch (error: any) {
          // If TRUNCATE fails, try DELETE
          try {
            await connection.query(`DELETE FROM \`${table}\``);
            return { table, success: true, method: 'DELETE' };
          } catch (deleteError: any) {
            return { table, success: false, error: deleteError.message };
          }
        }
      });

      const results = await Promise.allSettled(truncatePromises);
      
      const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        console.log(`   ⚠️  ${successCount}/${tables.length} tables cleaned, ${failCount} failed`);
      } else {
        console.log(`   ✅ All ${tables.length} tables cleaned`);
      }

      // Re-enable settings
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      await connection.query('SET UNIQUE_CHECKS = 1');
    } catch (error: any) {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      await connection.query('SET UNIQUE_CHECKS = 1');
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * MAIN METHOD: Generate CSVs, Upload to S3, Load to Aurora
   */
  async importToDatabase(extractedPath: string): Promise<any> {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(80));
    console.log('🚀 NEW IMPORT PROCESS: CSV → S3 → Aurora LOAD DATA');
    console.log('='.repeat(80));

    try {
      // Step 1: Generate CSV files
      console.log('\n📝 STEP 1/3: Generating CSV files...');
      const csvResult = await this.generateCSVFiles(extractedPath);
      console.log(`✅ CSV generation complete: ${csvResult.totalFiles} files processed`);
      console.log(`   Total records: ${csvResult.totalRecords.toLocaleString()}`);
      console.log(`   Duration: ${csvResult.duration}`);
      Logger.info('[IMPORT] CSV files constructed successfully', {
        totalFiles: csvResult.totalFiles,
        totalRecords: csvResult.totalRecords,
        duration: csvResult.duration
      });

      // Step 2: Upload to S3
      console.log('\n☁️  STEP 2/3: Uploading CSV files to S3...');
      Logger.info('[IMPORT] Starting S3 upload...');
      const s3Result = await this.uploadCSVsToS3();
      console.log(`✅ S3 upload complete: ${Object.keys(s3Result.locations).length} files uploaded`);
      console.log(`   Duration: ${s3Result.duration}`);

      // Step 3: Load from S3 to Aurora
      console.log('\n💾 STEP 3/3: Loading data from S3 to Aurora...');
      const loadResult = await this.loadFromS3ToAurora(s3Result.locations);
      console.log(`✅ Database load complete`);
      console.log(`   Duration: ${loadResult.duration}`);

      // Step 4: Fetch hotel names from Content API
      console.log('\n🏨 STEP 4: Fetching hotel names from Content API...');
      const nameStart = Date.now();
      try {
        const [placeholders]: any = await pool.query(
          'SELECT id FROM hotels WHERE name LIKE "Property %" ORDER BY id'
        );
        
        if (placeholders.length > 0) {
          console.log(`   Found ${placeholders.length} hotels with placeholder names`);
          let updated = 0;
          
          // Batch fetch in groups of 1000 (Content API limit)
          for (let i = 0; i < placeholders.length; i += 1000) {
            const batch = placeholders.slice(i, i + 1000);
            const codes = batch.map((h: any) => h.id).join(',');
            
            try {
              const response = await axios.get(
                'https://api.hotelbeds.com/hotel-content-api/1.0/hotels',
                {
                  params: { codes, fields: 'name', language: 'ENG' },
                  headers: {
                    'Api-key': env.HOTELBEDS_API_KEY,
                    'Accept': 'application/json'
                  },
                  timeout: 30000
                }
              );
              
              const hotels = response.data?.hotels || [];
              for (const hotel of hotels) {
                if (hotel.code && hotel.name?.content) {
                  await pool.query(
                    'UPDATE hotels SET name = ? WHERE id = ?',
                    [hotel.name.content, hotel.code]
                  );
                  updated++;
                }
              }
              
              console.log(`   Progress: ${updated}/${placeholders.length}`);
            } catch (error: any) {
              console.log(`   ⚠️  Batch ${i}-${i + 1000} failed: ${error.message}`);
            }
          }
          
          const nameDuration = ((Date.now() - nameStart) / 1000).toFixed(2);
          console.log(`✅ Updated ${updated} hotel names in ${nameDuration}s`);
        } else {
          console.log('   ✅ No placeholder names found');
        }
      } catch (error: any) {
        console.log(`⚠️  Name fetch failed: ${error.message}`);
        console.log('   Continuing with placeholder names...');
      }

      // Step 5: Compute cheapest prices immediately after import
      console.log('\n💰 STEP 5: Computing cheapest prices with hotel details...');
      const priceStart = Date.now();
      
      const connection = await pool.getConnection();
      try {
        await connection.query('TRUNCATE TABLE cheapest_pp');

        await connection.query(`
          INSERT INTO cheapest_pp 
          (hotel_id, hotel_name, destination_code, country_code, hotel_category, latitude, longitude,
           category_tag, start_date, end_date, nights, board_code, room_code, 
           price_pp, total_price, currency, has_promotion)
          SELECT 
            h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude,
            'CITY_TRIP', MIN(r.date_from), DATE_ADD(MIN(r.date_from), INTERVAL 2 DAY), 2, 'RO', 'STD',
            ROUND(MIN(r.price) * 2 / 2, 2), ROUND(MIN(r.price) * 2, 2), 'EUR', 0
          FROM hotel_rates r
          JOIN hotels h ON r.hotel_id = h.id
          WHERE r.price > 0
          GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude
        `);

        await connection.query(`
          INSERT INTO cheapest_pp 
          (hotel_id, hotel_name, destination_code, country_code, hotel_category, latitude, longitude,
           category_tag, start_date, end_date, nights, board_code, room_code, 
           price_pp, total_price, currency, has_promotion)
          SELECT 
            h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude,
            'OTHER', MIN(r.date_from), DATE_ADD(MIN(r.date_from), INTERVAL 5 DAY), 5, 'RO', 'STD',
            ROUND(MIN(r.price) * 5 / 2, 2), ROUND(MIN(r.price) * 5, 2), 'EUR', 0
          FROM hotel_rates r
          JOIN hotels h ON r.hotel_id = h.id
          WHERE r.price > 0
          GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude
        `);

        const [priceResult]: any = await connection.query('SELECT COUNT(*) as count FROM cheapest_pp');
        const priceDuration = ((Date.now() - priceStart) / 1000).toFixed(2);
        console.log(`✅ Computed ${priceResult[0].count.toLocaleString()} cheapest prices in ${priceDuration}s`);
      } finally {
        connection.release();
      }

      const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

      console.log('\n' + '='.repeat(80));
      console.log('✨ IMPORT PROCESS COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(80));
      console.log(`⏱️  Total Duration: ${totalDuration} minutes`);
      console.log(`📊 Total Records: ${csvResult.totalRecords.toLocaleString()}`);
      console.log(`🎯 Target: 30 minutes - Actual: ${totalDuration} minutes`);
      console.log('='.repeat(80) + '\n');

      return {
        success: true,
        csv: csvResult,
        s3: s3Result,
        load: loadResult,
        totalDuration: `${totalDuration} minutes`,
        totalRecords: csvResult.totalRecords,
      };
    } catch (error: any) {
      Logger.error('[IMPORT] Import process failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Step 1: Generate CSV files from extracted data
   */
  private async generateCSVFiles(extractedPath: string): Promise<any> {
    const startTime = Date.now();

    // Clean CSV directory
    if (fs.existsSync(this.csvDir)) {
      fs.rmSync(this.csvDir, { recursive: true });
    }
    fs.mkdirSync(this.csvDir, { recursive: true });

    // Process GENERAL folder files FIRST (GHOT_F, IDES_F, GCAT_F)
    const generalPath = path.join(extractedPath, 'GENERAL');
    if (fs.existsSync(generalPath)) {
      const { GeneralFilesParser } = await import('@/utils/generalFilesParser');
      await GeneralFilesParser.processGeneralFiles(generalPath, this.csvDir);
    }

    // Find DESTINATIONS folder
    const destinationsDir = path.join(extractedPath, 'DESTINATIONS');
    if (!fs.existsSync(destinationsDir)) {
      throw new Error('DESTINATIONS folder not found');
    }

      const destFolders = fs.readdirSync(destinationsDir).filter(f => {
        return fs.lstatSync(path.join(destinationsDir, f)).isDirectory();
      });

    const totalFiles = destFolders.reduce((count, folder) => {
      const folderPath = path.join(destinationsDir, folder);
      const files = fs.readdirSync(folderPath).filter(f => fs.lstatSync(path.join(folderPath, f)).isFile());
      return count + files.length;
    }, 0);

    console.log(`   Found ${destFolders.length} destinations with ${totalFiles.toLocaleString()} hotel files`);

    // Create CSV writers
    const writers = this.csvGenerator.createCSVWriters();

      let processedFiles = 0;
      let failedFiles = 0;
    // Removed processedHotelIds Set - DB IGNORE will handle duplicates, saves memory

    // Process files in parallel batches optimized for r7a.xlarge (4 vCPUs, 32GB RAM)
    // MAXIMUM aggressive parallelization - use the full 32GB RAM!
    const BATCH_SIZE = 25000; // Very large batches - 32GB RAM can easily handle this
    const CONCURRENT_FILES = 200; // Process 200 files in parallel - streaming is I/O bound, memory per file is tiny, can go very aggressive!
    let lastProgress = 0;

    // Collect all files first
    const allFiles: Array<{ filePath: string; hotelId: number }> = [];
    
    for (const destFolder of destFolders) {
            const destPath = path.join(destinationsDir, destFolder);
            const hotelFiles = fs.readdirSync(destPath).filter(f => {
              return fs.lstatSync(path.join(destPath, f)).isFile();
            });

      for (const hotelFile of hotelFiles) {
                  const filePath = path.join(destPath, hotelFile);
        const hotelId = this.csvGenerator.extractHotelIdFromFilename(hotelFile);
        
        if (hotelId) {
          allFiles.push({ filePath, hotelId });
        }
      }
    }

    console.log(`   Processing ${allFiles.length.toLocaleString()} files in parallel batches...`);

    // Process files in parallel batches
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);
      
      // Process files in aggressive parallel chunks - r7a.xlarge has 32GB RAM
      for (let j = 0; j < batch.length; j += CONCURRENT_FILES) {
        const concurrentGroup = batch.slice(j, j + CONCURRENT_FILES);
        
        // Process files in parallel
        const results = await Promise.allSettled(
          concurrentGroup.map(({ filePath, hotelId }) =>
            this.csvGenerator.processHotelFile(writers, filePath, hotelId).catch((error: any) => {
              Logger.error(`[CSV] Error processing file: ${filePath}`, { error: error.message });
              return false;
            })
          )
        );

        // Count successes and failures
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            processedFiles++;
          } else {
            failedFiles++;
          }
        });
      }

      // Garbage collection much less frequently - r7a.xlarge has 32GB RAM, we want to USE it!
      if (global.gc && i % (BATCH_SIZE * 10) === 0) {
        global.gc();
      }

      // Progress update
      const progress = ((processedFiles / totalFiles) * 100);
      if (progress - lastProgress >= 1) {
        const memoryUsage = process.memoryUsage();
        const usedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const totalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const rssMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
        console.log(`   Progress: ${processedFiles.toLocaleString()}/${totalFiles.toLocaleString()} (${progress.toFixed(1)}%) - Memory: ${usedMB}MB/${totalMB}MB (RSS: ${rssMB}MB)`);
        lastProgress = progress;
      }
    }

    // Close all writers
    await this.csvGenerator.closeWriters(writers);

    // Log duplicate detection summary
    console.log('\n📊 DUPLICATE DETECTION SUMMARY:');
    this.csvGenerator.logDuplicateSummary();

    // Clear duplicate detector to free memory
    this.csvGenerator.clearDuplicateDetector();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = this.csvGenerator.getCSVSummary(writers);

    // Calculate total records
    const totalRecords = Object.values(summary).reduce((sum: number, table: any) => sum + table.records, 0);

      return {
      success: true,
      totalFiles: processedFiles,
      failedFiles,
      totalRecords,
      duration: `${duration}s`,
      summary,
    };
  }

  /**
   * Step 2: Upload CSV files to S3
   */
  private async uploadCSVsToS3(): Promise<any> {
    const startTime = Date.now();

    // Test S3 connection
    const canConnect = await this.s3Uploader.testConnection();
    if (!canConnect) {
      throw new Error('Cannot connect to S3 bucket');
    }

    // Upload all CSV files
    const locations = await this.s3Uploader.uploadDirectory(this.csvDir);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return {
      success: true,
      filesUploaded: Object.keys(locations).length,
      locations,
      duration: `${duration}s`,
    };
  }

  /**
   * Step 3: Load data from S3 to Aurora using LOAD DATA FROM S3
   */
  private async loadFromS3ToAurora(s3Locations: Record<string, string>): Promise<any> {
    const startTime = Date.now();
    let connection;
    
    try {
      connection = await pool.getConnection();
    } catch (error: any) {
      Logger.error('[LOAD] Failed to get database connection', { error: error.message });
      throw error;
    }

    try {
      console.log('   🔍 Checking S3 integration...');
      
      // Check if S3 integration is enabled
      try {
        const [s3Check]: any = await connection.query('SELECT * FROM mysql.aws_s3_integration LIMIT 1');
        if (s3Check.length === 0) {
          console.log('   ⚠️  WARNING: S3 integration not enabled!');
          console.log('   Run: npm run enable-s3');
          console.log('   Or check IAM role is attached to Aurora cluster');
        } else {
          console.log('   ✅ S3 integration enabled');
        }
      } catch (s3CheckError: any) {
        if (s3CheckError.message && s3CheckError.message.includes("doesn't exist")) {
          console.log('   ⚠️  WARNING: S3 integration table not found!');
          console.log('   This might mean S3 integration is not set up');
          console.log('   Run: npm run enable-s3');
        }
      }
      
      console.log('   🔧 Optimizing database settings...');
      
      // Optimize for bulk load with extended timeouts
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query('SET UNIQUE_CHECKS = 0');
      await connection.query('SET AUTOCOMMIT = 0');
      await connection.query('SET SESSION wait_timeout = 86400');
      await connection.query('SET SESSION interactive_timeout = 86400');
      await connection.query('SET SESSION net_read_timeout = 86400');
      await connection.query('SET SESSION net_write_timeout = 86400');
      await connection.query('SET SESSION max_execution_time = 0');
      
      console.log('   ✅ Database settings optimized');

      const tables = [
        // Core master data FIRST
        { name: 'hotels', csv: 'hotels.csv' },
        { name: 'destinations', csv: 'destinations.csv' },
        { name: 'categories', csv: 'categories.csv' },
        // Hotel detail data
        { name: 'hotel_contracts', csv: 'hotel_contracts.csv' },
        { name: 'hotel_room_allocations', csv: 'hotel_room_allocations.csv' },
        { name: 'hotel_inventory', csv: 'hotel_inventory.csv' },
        { name: 'hotel_rates', csv: 'hotel_rates.csv' }, // Biggest
        { name: 'hotel_supplements', csv: 'hotel_supplements.csv' },
        { name: 'hotel_occupancy_rules', csv: 'hotel_occupancy_rules.csv' },
        { name: 'hotel_email_settings', csv: 'hotel_email_settings.csv' },
        { name: 'hotel_rate_tags', csv: 'hotel_rate_tags.csv' },
        { name: 'hotel_configurations', csv: 'hotel_configurations.csv' },
        { name: 'hotel_promotions', csv: 'hotel_promotions.csv' },
        { name: 'hotel_special_requests', csv: 'hotel_special_requests.csv' },
        { name: 'hotel_groups', csv: 'hotel_groups.csv' },
        { name: 'hotel_cancellation_policies', csv: 'hotel_cancellation_policies.csv' },
        { name: 'hotel_special_conditions', csv: 'hotel_special_conditions.csv' },
        { name: 'hotel_room_features', csv: 'hotel_room_features.csv' },
        { name: 'hotel_pricing_rules', csv: 'hotel_pricing_rules.csv' },
        { name: 'hotel_tax_info', csv: 'hotel_tax_info.csv' },
      ];

      const results: any = {};

      for (const table of tables) {
        const tableStart = Date.now();
        console.log(`   Loading ${table.name}...`);

        try {
          const csvPath = path.join(this.csvDir, table.csv);
          
          if (!fs.existsSync(csvPath)) {
            console.log(`   ⏭️  Skipping ${table.name} (no CSV file)`);
            continue;
          }
          
          // Get fresh connection for each table to avoid timeout
          let tableConnection;
          try {
            tableConnection = await pool.getConnection();
            await tableConnection.query('SET SESSION wait_timeout = 86400');
            await tableConnection.query('SET SESSION net_read_timeout = 86400');
            await tableConnection.query('SET SESSION net_write_timeout = 86400');
          } catch (connError: any) {
            console.log(`   ⚠️  Connection error for ${table.name}: ${connError.message}`);
            throw connError;
          }

          // Column mappings for each table
          const columnMappings: Record<string, string> = {
            hotels: '(id,category,destination_code,chain_code,accommodation_type,ranking,group_hotel,country_code,state_code,longitude,latitude,name)',
            destinations: '(code,country_code,is_available)',
            categories: '(code,simple_code)',
            hotel_contracts: '(hotel_id,destination_code,contract_code,rate_code,board_code,contract_type,date_from,date_to,currency,board_type)',
            hotel_room_allocations: '(hotel_id,room_code,board_code,min_adults,max_adults,min_children,max_children,min_pax,max_pax,allocation)',
            hotel_inventory: '(hotel_id,room_code,board_code,date_from,date_to,availability_data)',
            hotel_rates: '(hotel_id,room_code,board_code,date_from,date_to,rate_type,base_price,tax_amount,adults,board_type,price)',
            hotel_supplements: '(hotel_id,date_from,date_to,supplement_code,supplement_type,discount_percent,min_nights)',
            hotel_occupancy_rules: '(hotel_id,rule_from,rule_to,is_allowed)',
            hotel_email_settings: '(hotel_id,date_from,date_to,email_type,room_type,room_code,email_content)',
            hotel_rate_tags: '(hotel_id,rate_code,tag_type,tag_value)',
            hotel_configurations: '(hotel_id,config_key,config_value,date_from,date_to)',
            hotel_groups: '(hotel_id,group_code,group_type,date_from,date_to)',
            hotel_special_requests: '(hotel_id,request_code,request_type,request_description)',
            hotel_special_conditions: '(hotel_id,condition_code,condition_type,condition_description)',
            hotel_pricing_rules: '(hotel_id,rule_code,rule_type,date_from,date_to,adjustment_value)',
          };

          const columns = columnMappings[table.name] || '';

          const query = `
            LOAD DATA LOCAL INFILE '${csvPath}'
            IGNORE
            INTO TABLE ${table.name}
            FIELDS TERMINATED BY ','
            ENCLOSED BY '"'
            LINES TERMINATED BY '\\n'
            IGNORE 1 ROWS
            ${columns}
          `;

          const [result]: any = await tableConnection.query(query);
          const duration = ((Date.now() - tableStart) / 1000).toFixed(2);
          const rowsAffected = result.affectedRows || 0;
          
          tableConnection.release();
          
          console.log(`   ✅ ${table.name} loaded in ${duration}s (Rows: ${rowsAffected.toLocaleString()})`);
          
          results[table.name] = {
            success: true,
            duration: `${duration}s`,
            rowsAffected: rowsAffected,
          };
        } catch (error: any) {
          console.error(`   ❌ ${table.name} failed:`, error.message);
          results[table.name] = {
            success: false,
            error: error.message,
          };
        }
      }

      console.log('   💾 Committing transaction...');
      await connection.query('COMMIT');

      console.log('   🔧 Restoring database settings...');
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      await connection.query('SET UNIQUE_CHECKS = 1');
      await connection.query('SET AUTOCOMMIT = 1');

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        success: true,
        tables: results,
        duration: `${duration}s`,
      };
    } catch (error: any) {
      try {
        await connection.query('ROLLBACK');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        await connection.query('SET UNIQUE_CHECKS = 1');
        await connection.query('SET AUTOCOMMIT = 1');
      } catch (cleanupError) {
        console.log('Connection cleanup failed (connection may be closed)');
      }
      throw error;
    } finally {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.log('Connection release failed (already released)');
        }
      }
    }
  }

  /**
   * Find extracted folder (utility method)
   */
  async findExtractedFolder(folderName?: string): Promise<string> {
    if (!fs.existsSync(this.downloadsDir)) {
      throw new Error('Downloads directory not found');
    }

    const folders = fs.readdirSync(this.downloadsDir).filter(f => {
      const fullPath = path.join(this.downloadsDir, f);
      return fs.lstatSync(fullPath).isDirectory() && !f.includes('csv_output');
    });

    if (folders.length === 0) {
      throw new Error('No extracted folders found');
    }

    if (folderName) {
      const found = folders.find(f => f.includes(folderName));
      if (!found) {
        throw new Error(`Folder ${folderName} not found`);
      }
      return path.join(this.downloadsDir, found);
    }

    // Return latest folder
    const latest = folders.sort((a, b) => {
      const aTime = fs.statSync(path.join(this.downloadsDir, a)).mtime.getTime();
      const bTime = fs.statSync(path.join(this.downloadsDir, b)).mtime.getTime();
      return bTime - aTime;
    })[0];

    return path.join(this.downloadsDir, latest);
  }

  // ============================================
  // QUERY METHODS (For API endpoints)
  // ============================================

  /**
   * Get hotels with filters and pagination
   */
  async getHotels(page?: number, limit?: number, filters?: any): Promise<any> {
    try {
      const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.destination_code) {
        conditions.push('destination_code = ?');
      params.push(filters.destination_code);
    }

    if (filters?.category) {
        conditions.push('category = ?');
      params.push(filters.category);
    }

    if (filters?.country_code) {
        conditions.push('country_code = ?');
      params.push(filters.country_code);
    }

    if (filters?.name) {
        conditions.push('name LIKE ?');
      params.push(`%${filters.name}%`);
    }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      if (page && limit) {
        const offset = (page - 1) * limit;
      const countQuery = `SELECT COUNT(*) as total FROM hotels ${whereClause}`;
      const [countResult]: any = await pool.query(countQuery, params);
      const total = countResult[0].total;

        const dataQuery = `
          SELECT * FROM hotels
          ${whereClause}
          ORDER BY id ASC
          LIMIT ? OFFSET ?
        `;
        const [rows]: any = await pool.query(dataQuery, [...params, limit, offset]);

        return {
          data: rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      } else {
        const dataQuery = `SELECT * FROM hotels ${whereClause} ORDER BY id ASC`;
        const [rows]: any = await pool.query(dataQuery, params);
        return { data: rows };
      }
    } catch (error: any) {
      Logger.error('[REPO] Error fetching hotels', { error: error.message });
      throw error;
    }
  }

  /**
   * Get hotel by ID
   */
  async getHotelById(hotelId: number): Promise<any> {
    try {
      const query = 'SELECT * FROM hotels WHERE id = ?';
      const [rows]: any = await pool.query(query, [hotelId]);
      return rows[0] || null;
    } catch (error: any) {
      Logger.error('[REPO] Error fetching hotel by ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Get hotel with full details from all tables
   */
  async getHotelFullDetails(hotelId: number): Promise<any> {
    try {
      const hotel = await this.getHotelById(hotelId);
      if (!hotel) return null;

      const [contracts]: any = await pool.query('SELECT * FROM hotel_contracts WHERE hotel_id = ?', [hotelId]);
      const [rates]: any = await pool.query('SELECT * FROM hotel_rates WHERE hotel_id = ? LIMIT 1000', [hotelId]);
      const [rooms]: any = await pool.query('SELECT * FROM hotel_room_allocations WHERE hotel_id = ?', [hotelId]);
      const [inventory]: any = await pool.query('SELECT * FROM hotel_inventory WHERE hotel_id = ? LIMIT 1000', [hotelId]);

      return {
        ...hotel,
        contracts: contracts || [],
          rates: rates || [],
        rooms: rooms || [],
          inventory: inventory || [],
      };
    } catch (error: any) {
      Logger.error('[REPO] Error fetching hotel full details', { error: error.message });
      throw error;
    }
  }

  /**
   * Get hotel rates with pagination
   */
  async getHotelRates(hotelId: number, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const offset = (page - 1) * limit;

      const countQuery = 'SELECT COUNT(*) as total FROM hotel_rates WHERE hotel_id = ?';
      const [countResult]: any = await pool.query(countQuery, [hotelId]);
      const total = countResult[0].total;

      const dataQuery = `
        SELECT * FROM hotel_rates
        WHERE hotel_id = ?
        ORDER BY date_from ASC
        LIMIT ? OFFSET ?
      `;
      const [rows]: any = await pool.query(dataQuery, [hotelId, limit, offset]);

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      Logger.error('[REPO] Error fetching hotel rates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get destinations
   */
  async getDestinations(page: number = 1, limit: number = 50): Promise<any> {
    try {
      const offset = (page - 1) * limit;

      const countQuery = 'SELECT COUNT(*) as total FROM destinations';
      const [countResult]: any = await pool.query(countQuery);
      const total = countResult[0].total;

      const dataQuery = `
        SELECT code, country_code, is_available, name
        FROM destinations
        ORDER BY code ASC
        LIMIT ? OFFSET ?
      `;
      const [rows]: any = await pool.query(dataQuery, [limit, offset]);

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      Logger.error('[REPO] Error fetching destinations', { error: error.message });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const tables = [
        'hotels',
        'hotel_contracts',
        'hotel_rates',
        'hotel_inventory',
        'hotel_room_allocations',
        'hotel_supplements',
        'hotel_occupancy_rules',
        'hotel_email_settings',
        'hotel_rate_tags',
        'hotel_configurations',
        'hotel_promotions',
        'hotel_special_requests',
        'hotel_groups',
        'hotel_cancellation_policies',
        'hotel_special_conditions',
        'hotel_room_features',
        'hotel_pricing_rules',
        'hotel_tax_info',
      ];

      const stats: any = {};

      for (const table of tables) {
        const [result]: any = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = result[0].count;
      }

      return stats;
    } catch (error: any) {
      Logger.error('[REPO] Error fetching database stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Compute cheapest prices per person
   */
  async computeCheapestPrices(category: string = 'ALL', hotelId?: number): Promise<any> {
    const start = Date.now();

    Logger.info('⚡ Computing cheapest prices...');
    await this.createCheapestPPTable();

    const cats = category === 'ALL' ? ['CITY_TRIP', 'OTHER'] : [category];

    try {
      Logger.info('🗑️  Cleaning old prices...');
      if (hotelId) {
        await pool.query('DELETE FROM cheapest_pp WHERE hotel_id = ?', [hotelId]);
      } else {
        await pool.query('TRUNCATE TABLE cheapest_pp');
      }

      await pool.query('SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');

      let total = 0;

      for (const cat of cats) {
        const n = cat === 'CITY_TRIP' ? 2 : 5;
        Logger.info(`Computing ${cat}...`);

        const [res]: any = await pool.query(`
          INSERT INTO cheapest_pp 
          (hotel_id, hotel_name, destination_code, country_code, hotel_category, latitude, longitude,
           category_tag, start_date, end_date, nights, board_code, room_code, 
           price_pp, total_price, currency, has_promotion)
          SELECT 
            h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude,
            ?, MIN(r.date_from), DATE_ADD(MIN(r.date_from), INTERVAL ? DAY), ?, 'RO', 'STD',
            ROUND(MIN(r.price) * ? / 2, 2), ROUND(MIN(r.price) * ?, 2), 'EUR', 0
          FROM hotel_rates r
          INNER JOIN hotels h ON h.id = r.hotel_id
          WHERE r.price > 0
          ${hotelId ? 'AND r.hotel_id = ?' : ''}
          GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude
          ON DUPLICATE KEY UPDATE 
            hotel_name = VALUES(hotel_name),
            price_pp = VALUES(price_pp), 
            total_price = VALUES(total_price), 
            derived_at = NOW()
        `, hotelId ? [cat, n, n, n, n, hotelId] : [cat, n, n, n, n]);

        total += res.affectedRows || 0;
        Logger.info(`✅ ${cat}: ${res.affectedRows}`);
      }

      await pool.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');

      const dur = ((Date.now() - start) / 1000).toFixed(2);
      Logger.info(`✅ ${total} prices computed in ${dur}s`);

      return { success: true, computed: total, duration: `${dur}s` };
    } catch (error: any) {
      await pool.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ').catch(() => {});
      await pool.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      Logger.error('❌ Compute prices failed:', error);
      throw error;
    }
  }

  /**
   * Create cheapest_pp table if not exists
   */
  private async createCheapestPPTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cheapest_pp (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotel_id INT NOT NULL,
        hotel_name VARCHAR(255),
        destination_code VARCHAR(10),
        country_code VARCHAR(5),
        hotel_category VARCHAR(50),
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        category_tag VARCHAR(50),
        start_date DATE,
        end_date DATE,
        nights INT,
        board_code VARCHAR(10),
        room_code VARCHAR(50),
        price_pp DECIMAL(10,2),
        total_price DECIMAL(10,2),
        currency VARCHAR(10),
        has_promotion TINYINT(1) DEFAULT 0,
        derived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_hotel_category (hotel_id, category_tag),
        INDEX idx_hotel (hotel_id),
        INDEX idx_category (category_tag),
        INDEX idx_price (price_pp)
      )
    `);
  }

  /**
   * Search hotels with cheapest prices
   */
  async searchHotels(filters: any, sort: string, page: number, limit: number): Promise<any> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filters.destination) {
        conditions.push('cp.destination_code = ?');
        params.push(filters.destination);
      }

      if (filters.category) {
        conditions.push('cp.category_tag = ?');
        params.push(filters.category);
      }

      if (filters.name) {
        conditions.push('cp.hotel_name LIKE ?');
        params.push(`%${filters.name}%`);
      }

      if (filters.priceMin !== undefined) {
        conditions.push('cp.price_pp >= ?');
        params.push(filters.priceMin);
      }

      if (filters.priceMax !== undefined) {
        conditions.push('cp.price_pp <= ?');
        params.push(filters.priceMax);
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      const sortMap: any = {
        price_asc: 'cp.price_pp ASC',
        price_desc: 'cp.price_pp DESC',
        name_asc: 'cp.hotel_name ASC',
        name_desc: 'cp.hotel_name DESC',
      };
      const orderBy = sortMap[sort] || 'cp.price_pp ASC';

      const countQuery = `
        SELECT COUNT(*) as total
        FROM cheapest_pp cp
        ${whereClause}
      `;
      const [countResult]: any = await pool.query(countQuery, params);
      const total = countResult[0].total;

      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT 
          cp.hotel_id as hotelId,
          cp.hotel_name as name,
          cp.price_pp as fromPricePP,
          cp.currency,
          cp.board_code as board,
          cp.start_date as startDate,
          cp.end_date as endDate,
          cp.nights,
          cp.category_tag as category,
          cp.destination_code as destination,
          cp.country_code as country,
          cp.hotel_category as hotelCategory,
          cp.latitude,
          cp.longitude
        FROM cheapest_pp cp
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;

      const [rows]: any = await pool.query(dataQuery, [...params, limit, offset]);

        return {
        data: rows,
          pagination: {
            page,
            limit,
            total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      Logger.error('[REPO] Search error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get available rooms for a hotel
   */
  async getAvailableRooms(
    hotelId: number,
    checkIn?: string,
    nights?: number,
    page: number = 1,
    limit: number = 10,
    maxDates: number = 10
  ): Promise<any> {
    try {
      let dateFilter = '';
      const params: any[] = [hotelId];

      if (checkIn && nights) {
        dateFilter = 'AND r.date_from >= ? AND r.date_from < DATE_ADD(?, INTERVAL ? DAY)';
        params.push(checkIn, checkIn, nights);
      }

      const countQuery = `
        SELECT COUNT(DISTINCT r.room_code) as total
        FROM hotel_rates r
        WHERE r.hotel_id = ? AND r.price > 0 ${dateFilter}
      `;
      const [countResult]: any = await pool.query(countQuery, params);
      const total = countResult[0].total;

      const offset = (page - 1) * limit;
      const query = `
        SELECT 
          r.room_code,
          r.board_code,
          DATE_FORMAT(r.date_from, '%Y-%m-%d') as date_from,
          r.price,
          r.adults
        FROM hotel_rates r
        WHERE r.hotel_id = ? AND r.price > 0 ${dateFilter}
        ORDER BY r.room_code, r.date_from
        LIMIT ? OFFSET ?
      `;

      const [rooms]: any = await pool.query(query, [...params, limit * maxDates, offset * maxDates]);

      const roomsMap = new Map();
      for (const room of rooms) {
        if (!roomsMap.has(room.room_code)) {
          roomsMap.set(room.room_code, {
            roomCode: room.room_code,
            boardCode: room.board_code,
            dates: [],
          });
        }
        roomsMap.get(room.room_code).dates.push({
          date: room.date_from,
          price: parseFloat(room.price),
            adults: room.adults,
        });
      }

      const roomsArray = Array.from(roomsMap.values()).map(room => ({
        ...room,
        dates: room.dates.slice(0, maxDates),
        totalDates: room.dates.length,
      }));

      return {
        data: roomsArray,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error: any) {
      Logger.error('[REPO] Error getting available rooms', { error: error.message });
      throw error;
    }
  }

  /**
   * Check availability for specific dates
   */
  async checkAvailability(hotelId: number, checkIn: string, nights: number, roomCodeFilter?: string): Promise<any> {
    try {
      // Calculate checkout date
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + nights);
      const checkOut = checkOutDate.toISOString().split('T')[0];

      // First, fetch hotel details from hotels table
      const [hotelDetails]: any = await pool.query(
        `
        SELECT 
          id,
          name as hotel_name,
          destination_code,
          country_code,
          category as hotel_category,
          latitude,
          longitude,
          chain_code,
          accommodation_type,
          ranking,
          state_code
        FROM hotels
        WHERE id = ?
      `,
        [hotelId]
      );

      const hotel = hotelDetails && hotelDetails.length > 0 ? hotelDetails[0] : null;

      const roomFilter = roomCodeFilter ? 'AND room_code = ?' : '';
      const params = roomCodeFilter ? [hotelId, checkIn, checkIn, nights, roomCodeFilter] : [hotelId, checkIn, checkIn, nights];

      const [rates]: any = await pool.query(
        `
        SELECT 
          room_code,
          DATE_FORMAT(date_from, '%Y-%m-%d') as date_from,
          price,
          board_code,
          adults
        FROM hotel_rates
        WHERE hotel_id = ?
          AND date_from >= ?
          AND date_from < DATE_ADD(?, INTERVAL ? DAY)
          AND price > 0
          ${roomFilter}
        ORDER BY room_code, date_from
      `,
        params
      );

      if (!rates || rates.length === 0) {
        return {
          hotelId,
          hotelName: hotel?.hotel_name || null,
          countryCode: hotel?.country_code || null,
          destinationCode: hotel?.destination_code || null,
          hotelCategory: hotel?.hotel_category || null,
          latitude: hotel?.latitude || null,
          longitude: hotel?.longitude || null,
          chainCode: hotel?.chain_code || null,
          accommodationType: hotel?.accommodation_type || null,
          ranking: hotel?.ranking || null,
          stateCode: hotel?.state_code || null,
          checkIn,
          checkOut,
          nights,
          rooms: [],
          message: 'No rooms available',
        };
      }

      const roomsMap = new Map();
      for (const rate of rates) {
        if (!roomsMap.has(rate.room_code)) {
          roomsMap.set(rate.room_code, {
            roomCode: rate.room_code,
            boardCode: rate.board_code,
            rates: [],
            totalPrice: 0,
          });
        }

        const roomData = roomsMap.get(rate.room_code);
          roomData.rates.push({
          date: rate.date_from,
            price: parseFloat(rate.price),
          });
          roomData.totalPrice += parseFloat(rate.price);
      }

      const availableRooms = Array.from(roomsMap.values())
        .filter(room => room.rates.length === nights)
        .map(room => ({
        roomCode: room.roomCode,
        boardCode: room.boardCode,
        totalPrice: parseFloat(room.totalPrice.toFixed(2)),
        pricePerPerson: parseFloat((room.totalPrice / 2).toFixed(2)),
        currency: 'EUR',
          nightlyRates: room.rates,
      }));

      return {
        hotelId,
        hotelName: hotel?.hotel_name || null,
        countryCode: hotel?.country_code || null,
        destinationCode: hotel?.destination_code || null,
        hotelCategory: hotel?.hotel_category || null,
        latitude: hotel?.latitude ? parseFloat(hotel.latitude) : null,
        longitude: hotel?.longitude ? parseFloat(hotel.longitude) : null,
        chainCode: hotel?.chain_code || null,
        accommodationType: hotel?.accommodation_type || null,
        ranking: hotel?.ranking || null,
        stateCode: hotel?.state_code || null,
        checkIn,
        checkOut,
        nights,
        totalRooms: availableRooms.length,
        rooms: availableRooms,
      };
    } catch (error: any) {
      Logger.error('[REPO] Error checking availability', { error: error.message });
      throw error;
    }
  }
}

