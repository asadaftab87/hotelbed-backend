import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@config/database';
import Logger from '@/core/Logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { env } from '@config/globals';
import AdmZip from 'adm-zip';
import { CSVGenerator } from '@/utils/csvGenerator';
import { S3Uploader } from '@/utils/s3Uploader';
import { GeneralDataParser } from '@/utils/generalDataParser';

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

      // Step 2: Upload to S3
      console.log('\n☁️  STEP 2/3: Uploading CSV files to S3...');
      const s3Result = await this.uploadCSVsToS3();
      console.log(`✅ S3 upload complete: ${Object.keys(s3Result.locations).length} files uploaded`);
      console.log(`   Duration: ${s3Result.duration}`);

      // Step 3: Load from S3 to Aurora
      console.log('\n💾 STEP 3/3: Loading data from S3 to Aurora...');
      const loadResult = await this.loadFromS3ToAurora(s3Result.locations);
      console.log(`✅ Database load complete`);
      console.log(`   Duration: ${loadResult.duration}`);

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
      console.log('\n❌ IMPORT PROCESS FAILED!');
      console.log('Error:', error.message);
      throw error;
    }
  }

  /**
   * Upload existing CSVs to S3 and load to Aurora
   * Use when CSVs are already generated in downloads/csv_output/
   */
  async uploadAndLoadExistingCSVs(): Promise<any> {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(80));
    console.log('🚀 UPLOAD & LOAD EXISTING CSVs: S3 → Aurora LOAD DATA');
    console.log('='.repeat(80));

    try {
      // Verify CSVs exist
      const fs = require('fs');
      const csvFiles = fs.readdirSync(this.csvDir).filter((f: string) => f.endsWith('.csv'));
      
      if (csvFiles.length === 0) {
        throw new Error('No CSV files found in downloads/csv_output/. Generate CSVs first.');
      }

      console.log(`\n📁 Found ${csvFiles.length} CSV files in ${this.csvDir}`);

      // Step 1: Upload to S3
      console.log('\n☁️  STEP 1/2: Uploading CSV files to S3...');
      const s3Result = await this.uploadCSVsToS3();
      console.log(`✅ S3 upload complete: ${Object.keys(s3Result.locations).length} files uploaded`);
      console.log(`   Duration: ${s3Result.duration}`);

      // Step 2: Load from S3 to Aurora
      console.log('\n💾 STEP 2/2: Loading data from S3 to Aurora...');
      const loadResult = await this.loadFromS3ToAurora(s3Result.locations);
      console.log(`✅ Database load complete`);
      console.log(`   Duration: ${loadResult.duration}`);

      const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

      console.log('\n' + '='.repeat(80));
      console.log('✨ UPLOAD & LOAD COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(80));
      console.log(`⏱️  Total Duration: ${totalDuration} minutes`);
      console.log('='.repeat(80) + '\n');

      return {
        success: true,
        s3: s3Result,
        load: loadResult,
        totalDuration: `${totalDuration} minutes`,
      };
    } catch (error: any) {
      console.log('\n❌ UPLOAD & LOAD FAILED!');
      console.log('Error:', error.message);
      throw error;
    }
  }

  /**
   * Step 1: Generate CSV files from extracted data
   * UPDATED: Now processes GENERAL folder FIRST, then DESTINATIONS
   */
  private async generateCSVFiles(extractedPath: string): Promise<any> {
    const startTime = Date.now();

    // Clean CSV directory
    if (fs.existsSync(this.csvDir)) {
      fs.rmSync(this.csvDir, { recursive: true });
    }
    fs.mkdirSync(this.csvDir, { recursive: true });

    // Create CSV writers
    const writers = this.csvGenerator.createCSVWriters();

    // ============================================
    // STEP 1.1: Process GENERAL folder FIRST (NEW!)
    // ============================================
    console.log('\n📋 STEP 1.1: Processing GENERAL folder (master data)...');
    const generalDir = path.join(extractedPath, 'GENERAL');
    
    if (fs.existsSync(generalDir)) {
      try {
        const generalParser = new GeneralDataParser(generalDir);
        const generalData = await generalParser.parseAll();

        // Write to CSVs
        this.csvGenerator.writeChains(writers.chains, generalData.chains);
        this.csvGenerator.writeCategories(writers.categories, generalData.categories);
        this.csvGenerator.writeDestinations(writers.destinations, generalData.destinations);
        this.csvGenerator.writeHotels(writers.hotels, generalData.hotels);

        console.log(`   ✅ GENERAL data processed:`);
        console.log(`      Chains: ${generalData.chains.length.toLocaleString()}`);
        console.log(`      Categories: ${generalData.categories.length.toLocaleString()}`);
        console.log(`      Destinations: ${generalData.destinations.length.toLocaleString()}`);
        console.log(`      Hotels: ${generalData.hotels.length.toLocaleString()}`);
      } catch (error: any) {
        Logger.error('[CSV] Error processing GENERAL folder', { error: error.message });
        console.error(`   ⚠️  WARNING: GENERAL folder processing failed: ${error.message}`);
        console.error(`   This will result in empty master tables (chains, categories, destinations, hotels)`);
      }
    } else {
      Logger.warn('[CSV] GENERAL folder not found - skipping master data');
      console.log(`   ⚠️  WARNING: GENERAL folder not found`);
      console.log(`   Master tables (chains, categories, destinations, hotels) will be empty`);
    }

    // ============================================
    // STEP 1.2: Process DESTINATIONS folder (EXISTING)
    // ============================================
    console.log('\n📁 STEP 1.2: Processing DESTINATIONS folder (hotel-specific data)...');
    const destinationsDir = path.join(extractedPath, 'DESTINATIONS');
    if (!fs.existsSync(destinationsDir)) {
      throw new Error('DESTINATIONS folder not found');
    }

      const destFolders = fs.readdirSync(destinationsDir).filter((f: string) => {
        return fs.lstatSync(path.join(destinationsDir, f)).isDirectory();
      });

    const totalFiles = destFolders.reduce((count: number, folder: string) => {
      const folderPath = path.join(destinationsDir, folder);
      const files = fs.readdirSync(folderPath).filter((f: string) => fs.lstatSync(path.join(folderPath, f)).isFile());
      return count + files.length;
    }, 0);

    console.log(`   Found ${destFolders.length} destinations with ${totalFiles.toLocaleString()} hotel files`);

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
    const connection = await pool.getConnection();

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
      
      // Optimize for bulk load
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query('SET UNIQUE_CHECKS = 0');
      await connection.query('SET AUTOCOMMIT = 0');
      await connection.query('SET SESSION wait_timeout = 28800'); // 8 hours

      // UPDATED: Respect foreign key dependencies - load in correct order!
      const tables = [
        // PHASE 1: Master reference tables (NO foreign keys) - LOAD FIRST
        { name: 'chains', csv: 'chains.csv', phase: 1 },
        { name: 'categories', csv: 'categories.csv', phase: 1 },
        { name: 'destinations', csv: 'destinations.csv', phase: 1 },
        
        // PHASE 2: Hotels (references chains, categories, destinations) - LOAD SECOND
        { name: 'hotels', csv: 'hotels.csv', phase: 2 },
        
        // PHASE 3: Hotel-specific data (all reference hotels table) - LOAD THIRD
        { name: 'hotel_contracts', csv: 'hotel_contracts.csv', phase: 3 },
        { name: 'hotel_room_allocations', csv: 'hotel_room_allocations.csv', phase: 3 },
        { name: 'hotel_inventory', csv: 'hotel_inventory.csv', phase: 3 },
        { name: 'hotel_rates', csv: 'hotel_rates.csv', phase: 3 }, // Biggest table
        { name: 'hotel_supplements', csv: 'hotel_supplements.csv', phase: 3 },
        { name: 'hotel_occupancy_rules', csv: 'hotel_occupancy_rules.csv', phase: 3 },
        { name: 'hotel_email_settings', csv: 'hotel_email_settings.csv', phase: 3 },
        { name: 'hotel_rate_tags', csv: 'hotel_rate_tags.csv', phase: 3 },
        { name: 'hotel_configurations', csv: 'hotel_configurations.csv', phase: 3 },
        { name: 'hotel_promotions', csv: 'hotel_promotions.csv', phase: 3 },
        { name: 'hotel_special_requests', csv: 'hotel_special_requests.csv', phase: 3 },
        { name: 'hotel_groups', csv: 'hotel_groups.csv', phase: 3 },
        { name: 'hotel_cancellation_policies', csv: 'hotel_cancellation_policies.csv', phase: 3 },
        { name: 'hotel_special_conditions', csv: 'hotel_special_conditions.csv', phase: 3 },
        { name: 'hotel_room_features', csv: 'hotel_room_features.csv', phase: 3 },
        { name: 'hotel_pricing_rules', csv: 'hotel_pricing_rules.csv', phase: 3 },
        { name: 'hotel_tax_info', csv: 'hotel_tax_info.csv', phase: 3 },
      ];

      const results: any = {};

      for (const table of tables) {
        const tableStart = Date.now();
        
        const s3Url = this.s3Uploader.getS3Url(table.csv);
        console.log(`   Loading ${table.name}...`);

        try {
          // LOAD DATA FROM S3 - Aurora feature
        const query = `
            LOAD DATA FROM S3 '${s3Url}'
            IGNORE
            INTO TABLE ${table.name}
            FIELDS TERMINATED BY ','
            ENCLOSED BY '"'
            LINES TERMINATED BY '\\n'
            IGNORE 1 ROWS
          `;

          console.log(`   🔍 Executing LOAD DATA FROM S3: ${s3Url}`);
          const [result]: any = await connection.query(query);
          const duration = ((Date.now() - tableStart) / 1000).toFixed(2);
          
          // Get actual rows affected
          const rowsAffected = result.affectedRows || 'unknown';
          console.log(`   ✅ ${table.name} loaded in ${duration}s (Rows: ${rowsAffected})`);
          
          results[table.name] = {
            success: true,
            duration: `${duration}s`,
            rowsAffected: rowsAffected,
          };
        } catch (error: any) {
          console.error(`   ❌ ${table.name} failed:`, error.message);
          console.error(`   S3 URL: ${s3Url}`);
          console.error(`   Full error:`, error);
          
          // Check if it's S3 integration error
          if (error.message.includes('S3') || error.message.includes('s3') || error.message.includes('Access denied')) {
            console.error(`   ⚠️  S3 Integration Issue: Make sure IAM role is attached and procedure is enabled`);
            console.error(`   Run: npm run enable-s3`);
          }
          
          results[table.name] = {
            success: false,
            error: error.message,
            s3Url: s3Url,
          };
          
          // Don't stop on single table error, continue with others
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
      await connection.query('ROLLBACK');
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      await connection.query('SET UNIQUE_CHECKS = 1');
      await connection.query('SET AUTOCOMMIT = 1');
      throw error;
    } finally {
      connection.release();
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
  /**
   * Compute cheapest prices per hotel (CITY_TRIP & OTHER)
   * UPDATED: Added pre-checks to ensure data integrity
   */
  async computeCheapestPrices(category: string = 'ALL', hotelId?: number): Promise<any> {
    const start = Date.now();

    Logger.info('⚡ Computing cheapest prices...');
    
    // ============================================
    // PRE-CHECKS: Ensure data exists (NEW!)
    // ============================================
    Logger.info('🔍 Validating data before computation...');
    
    try {
      // Check hotels table
      const [hotelCount]: any = await pool.query('SELECT COUNT(*) as count FROM hotels');
      if (hotelCount[0].count === 0) {
        throw new Error('❌ Hotels table is empty. Import GENERAL folder data first.');
      }
      Logger.info(`   ✅ Hotels table: ${hotelCount[0].count.toLocaleString()} records`);

      // Check hotel_rates table
      const [ratesCount]: any = await pool.query('SELECT COUNT(*) as count FROM hotel_rates WHERE price > 0');
      if (ratesCount[0].count === 0) {
        throw new Error('❌ No valid rates found (price > 0). Import DESTINATIONS folder data first.');
      }
      Logger.info(`   ✅ Hotel rates table: ${ratesCount[0].count.toLocaleString()} valid rates`);

      // Check destinations table (optional warning)
      const [destCount]: any = await pool.query('SELECT COUNT(*) as count FROM destinations');
      if (destCount[0].count === 0) {
        Logger.warn('⚠️  Destinations table is empty. This may cause issues with filtering.');
      } else {
        Logger.info(`   ✅ Destinations table: ${destCount[0].count.toLocaleString()} records`);
      }
    } catch (error: any) {
      Logger.error('❌ Data validation failed', { error: error.message });
      throw error;
    }

    // ============================================
    // CREATE TABLE & COMPUTE PRICES
    // ============================================
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
          (hotel_id, category_tag, start_date, nights, board_code, room_code, price_pp, total_price, currency, has_promotion)
          SELECT r.hotel_id, ?, MIN(r.date_from), ?, 'RO', 'STD',
                 ROUND(MIN(r.price) * ? / 2, 2), ROUND(MIN(r.price) * ?, 2), 'EUR', 0
          FROM hotel_rates r
          INNER JOIN hotels h ON h.id = r.hotel_id
          WHERE r.price > 0
          ${hotelId ? 'AND r.hotel_id = ?' : ''}
          GROUP BY r.hotel_id
          ON DUPLICATE KEY UPDATE 
            price_pp = VALUES(price_pp), 
            total_price = VALUES(total_price), 
            derived_at = NOW()
        `, hotelId ? [cat, n, n, n, hotelId] : [cat, n, n, n]);

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
        category_tag VARCHAR(50),
        start_date DATE,
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
        conditions.push('h.destination_code = ?');
        params.push(filters.destination);
      }

      if (filters.category) {
        conditions.push('cp.category_tag = ?');
        params.push(filters.category);
      }

      if (filters.name) {
        conditions.push('h.name LIKE ?');
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
        name_asc: 'h.name ASC',
        name_desc: 'h.name DESC',
      };
      const orderBy = sortMap[sort] || 'cp.price_pp ASC';

      const countQuery = `
        SELECT COUNT(*) as total
        FROM cheapest_pp cp
        INNER JOIN hotels h ON h.id = cp.hotel_id
        ${whereClause}
      `;
      const [countResult]: any = await pool.query(countQuery, params);
      const total = countResult[0].total;

      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT 
          h.id as hotelId,
          h.name,
          cp.price_pp as fromPricePP,
          cp.currency,
          cp.board_code as board,
          cp.start_date as startDate,
          cp.nights,
          cp.category_tag as category,
          h.destination_code as destination,
          h.country_code as country
        FROM cheapest_pp cp
        INNER JOIN hotels h ON h.id = cp.hotel_id
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
          checkIn,
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
        checkIn,
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

