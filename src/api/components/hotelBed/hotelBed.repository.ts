import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@config/database';
import Logger from '@/core/Logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { env } from '@config/globals';
import AdmZip from 'adm-zip';

export class HotelBedFileRepository {
  private readonly downloadsDir = path.join(process.cwd(), 'downloads');
  private readonly extractDir = path.join(process.cwd(), 'downloads', 'extracted');
  private processingStatus: any = {
    currentAction: null,
    progress: 0,
    lastCompleted: null,
  };

  // ============================================
  // UTILITY METHODS FOR DEVELOPMENT
  // ============================================

  /**
   * Find extracted folder in downloads directory
   * @param folderName Optional specific folder name
   * @returns Path to extracted folder
   */
  async findExtractedFolder(folderName?: string): Promise<string> {
    try {
      if (!fs.existsSync(this.downloadsDir)) {
        throw new Error(`Downloads directory not found: ${this.downloadsDir}`);
      }

      // If folder name provided, use it
      if (folderName) {
        const folderPath = path.join(this.downloadsDir, folderName);
        if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
          Logger.info('[FIND] Using specified folder', { path: folderPath });
          return folderPath;
        } else {
          throw new Error(`Specified folder not found: ${folderName}`);
        }
      }

      // Find latest extracted folder
      const folders = fs.readdirSync(this.downloadsDir)
        .filter(f => {
          const fullPath = path.join(this.downloadsDir, f);
          return fs.lstatSync(fullPath).isDirectory() && f.startsWith('hotelbed_cache_');
        })
        .map(f => {
          const fullPath = path.join(this.downloadsDir, f);
          return {
            name: f,
            path: fullPath,
            mtime: fs.statSync(fullPath).mtime.getTime()
          };
        })
        .sort((a, b) => b.mtime - a.mtime); // Latest first

      if (folders.length === 0) {
        throw new Error('No extracted folders found in downloads/');
      }

      const latestFolder = folders[0];
      Logger.info('[FIND] Using latest extracted folder', {
        folder: latestFolder.name,
        path: latestFolder.path,
        modified: new Date(latestFolder.mtime)
      });

      return latestFolder.path;
    } catch (error: any) {
      Logger.error('[FIND] Failed to find extracted folder', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // DOWNLOAD METHODS
  // ============================================

  /**
   * Download HotelBed cache file with streaming support
   * @returns Download result with file details
   */
  async downloadCacheZip(): Promise<any> {
    const startTime = Date.now();
    this.processingStatus.currentAction = 'downloading';
    this.processingStatus.progress = 0;

    try {
      // Initialize download directory
      if (!fs.existsSync(this.downloadsDir)) {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
        Logger.info('[DOWNLOAD] Created downloads directory', { path: this.downloadsDir });
      }

      // Prepare download configuration
      const url = `${env.HOTELBEDS_BASE_URL}${env.HOTELBEDS_CACHE_ENDPOINT}`;
      const cacheType = env.HOTELBEDS_CACHE_TYPE;
      const fileName = `hotelbed_cache_${cacheType}_${Date.now()}.zip`;
      const filePath = path.join(this.downloadsDir, fileName);

      Logger.info('[DOWNLOAD] Starting HotelBeds cache download', {
        url,
        cacheType,
        fileName
      });

      // Initiate streaming download
      const response = await axios({
        method: 'GET',
        url,
        headers: {
          'Api-key': env.HOTELBEDS_API_KEY,
        },
        responseType: 'stream',
        timeout: 0,
      });

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      const totalMB = (totalSize / 1024 / 1024).toFixed(2);

      Logger.info('[DOWNLOAD] Download initiated', {
        totalSize: `${totalMB} MB`,
        contentType: response.headers['content-type']
      });

      const writer = fs.createWriteStream(filePath);

      // Progress tracking variables
      let downloadedSize = 0;
      let lastLoggedPercent = 0;
      let lastLoggedMB = 0;

      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        const downloadedMB = downloadedSize / 1024 / 1024;
        const totalMB = totalSize / 1024 / 1024;
        const percent = totalSize > 0 ? Math.floor((downloadedSize / totalSize) * 100) : 0;
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speedMBps = downloadedMB / elapsedSeconds;

        const shouldLog =
          (percent >= lastLoggedPercent + 5) ||
          (downloadedMB >= lastLoggedMB + 10);

        if (shouldLog) {
          if (totalSize > 0) {
            Logger.info('[DOWNLOAD] Progress update', {
              progress: `${percent}%`,
              downloaded: `${downloadedMB.toFixed(2)} MB`,
              total: `${totalMB.toFixed(2)} MB`,
              speed: `${speedMBps.toFixed(2)} MB/s`
            });
          } else {
            Logger.info('[DOWNLOAD] Progress update', {
              downloaded: `${downloadedMB.toFixed(2)} MB`,
              speed: `${speedMBps.toFixed(2)} MB/s`
            });
          }

          this.processingStatus.progress = percent;
          lastLoggedPercent = percent;
          lastLoggedMB = downloadedMB;
        }
      });

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const finalSizeMB = (downloadedSize / 1024 / 1024).toFixed(2);

      Logger.info('[DOWNLOAD] Download completed successfully', {
        fileName,
        fileSize: `${finalSizeMB} MB`,
        duration: `${duration}s`
      });

      this.processingStatus.currentAction = null;
      this.processingStatus.progress = 100;
      this.processingStatus.lastCompleted = 'download';

      return {
        status: 'downloaded',
        fileName,
        filePath,
        fileSize: downloadedSize,
        fileSizeMB: finalSizeMB,
        duration: `${duration}s`,
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.processingStatus.currentAction = null;

      Logger.error('[DOWNLOAD] Download failed', {
        error: error.message,
        url: `${env.HOTELBEDS_BASE_URL}${env.HOTELBEDS_CACHE_ENDPOINT}`,
        statusCode: error.response?.status,
        statusText: error.response?.statusText
      });

      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Download HotelBed update file with streaming support
   * @returns Download result with file details
   */
  async downloadUpdateZip(): Promise<any> {
    const startTime = Date.now();
    this.processingStatus.currentAction = 'downloading_update';
    this.processingStatus.progress = 0;

    try {
      // Initialize download directory
      if (!fs.existsSync(this.downloadsDir)) {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
        Logger.info('[DOWNLOAD-UPDATE] Created downloads directory', { path: this.downloadsDir });
      }

      // Prepare download configuration
      const url = `${env.HOTELBEDS_BASE_URL}${env.HOTELBEDS_UPDATE_ENDPOINT}`;
      const updateType = env.HOTELBEDS_UPDATE_TYPE;
      const fileName = `hotelbed_update_${updateType}_${Date.now()}.zip`;
      const filePath = path.join(this.downloadsDir, fileName);

      Logger.info('[DOWNLOAD-UPDATE] Starting HotelBeds update download', {
        url,
        updateType,
        fileName
      });

      // Initiate streaming download
      const response = await axios({
        method: 'GET',
        url,
        headers: {
          'Api-key': env.HOTELBEDS_API_KEY,
        },
        responseType: 'stream',
        timeout: 0,
      });

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      const totalMB = (totalSize / 1024 / 1024).toFixed(2);

      Logger.info('[DOWNLOAD-UPDATE] Download initiated', {
        totalSize: `${totalMB} MB`,
        contentType: response.headers['content-type']
      });

      const writer = fs.createWriteStream(filePath);

      // Progress tracking variables
      let downloadedSize = 0;
      let lastLoggedPercent = 0;
      let lastLoggedMB = 0;

      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        const downloadedMB = downloadedSize / 1024 / 1024;
        const totalMB = totalSize / 1024 / 1024;
        const percent = totalSize > 0 ? Math.floor((downloadedSize / totalSize) * 100) : 0;
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speedMBps = downloadedMB / elapsedSeconds;

        const shouldLog =
          (percent >= lastLoggedPercent + 5) ||
          (downloadedMB >= lastLoggedMB + 10);

        if (shouldLog) {
          if (totalSize > 0) {
            Logger.info('[DOWNLOAD-UPDATE] Progress update', {
              progress: `${percent}%`,
              downloaded: `${downloadedMB.toFixed(2)} MB`,
              total: `${totalMB.toFixed(2)} MB`,
              speed: `${speedMBps.toFixed(2)} MB/s`
            });
          } else {
            Logger.info('[DOWNLOAD-UPDATE] Progress update', {
              downloaded: `${downloadedMB.toFixed(2)} MB`,
              speed: `${speedMBps.toFixed(2)} MB/s`
            });
          }

          this.processingStatus.progress = percent;
          lastLoggedPercent = percent;
          lastLoggedMB = downloadedMB;
        }
      });

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const finalSizeMB = (downloadedSize / 1024 / 1024).toFixed(2);

      Logger.info('[DOWNLOAD-UPDATE] Download completed successfully', {
        fileName,
        fileSize: `${finalSizeMB} MB`,
        duration: `${duration}s`
      });

      this.processingStatus.currentAction = null;
      this.processingStatus.progress = 100;
      this.processingStatus.lastCompleted = 'download_update';

      return {
        status: 'downloaded',
        fileName,
        filePath,
        fileSize: downloadedSize,
        fileSizeMB: finalSizeMB,
        duration: `${duration}s`,
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.processingStatus.currentAction = null;

      Logger.error('[DOWNLOAD-UPDATE] Download failed', {
        error: error.message,
        url: `${env.HOTELBEDS_BASE_URL}${env.HOTELBEDS_UPDATE_ENDPOINT}`,
        statusCode: error.response?.status,
        statusText: error.response?.statusText
      });

      throw new Error(`Update download failed: ${error.message}`);
    }
  }

  // ============================================
  // EXTRACT METHODS
  // ============================================

  /**
   * Extract downloaded zip file
   * @param zipFilePath Path to the zip file
   * @returns Extraction result with file details
   */
  async extractZipFile(zipFilePath: string): Promise<any> {
    const startTime = Date.now();
    this.processingStatus.currentAction = 'extracting';
    this.processingStatus.progress = 0;

    try {
      // Verify zip file exists
      if (!fs.existsSync(zipFilePath)) {
        throw new Error(`Zip file not found: ${zipFilePath}`);
      }

      const zipFileName = path.basename(zipFilePath);
      const zipFileNameWithoutExt = path.basename(zipFilePath, '.zip');
      const fileStats = fs.statSync(zipFilePath);
      const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);

      // Create extraction directory based on zip file name
      const extractDir = path.join(this.downloadsDir, zipFileNameWithoutExt);

      Logger.info('[EXTRACT] Starting file extraction', {
        zipFile: zipFileName,
        fileSize: `${fileSizeMB} MB`,
        extractTo: extractDir
      });

      // Clean and recreate extract directory
      if (fs.existsSync(extractDir)) {
        Logger.info('[EXTRACT] Cleaning existing extraction directory', { path: extractDir });
        fs.rmSync(extractDir, { recursive: true, force: true });
      }

      fs.mkdirSync(extractDir, { recursive: true });
      Logger.info('[EXTRACT] Created extraction directory', { path: extractDir });

      // Load zip file
      Logger.info('[EXTRACT] Loading zip file');
      const zip = new AdmZip(zipFilePath);
      const zipEntries = zip.getEntries();
      const totalEntries = zipEntries.length;

      Logger.info('[EXTRACT] Zip file loaded', {
        totalFiles: totalEntries,
        files: zipEntries.slice(0, 5).map(e => e.entryName)
      });

      // Extract files with progress tracking
      let extractedCount = 0;
      let lastLoggedPercent = 0;

      for (const entry of zipEntries) {
        const targetPath = path.join(extractDir, entry.entryName);

        if (entry.isDirectory) {
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
          }
        } else {
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.writeFileSync(targetPath, entry.getData());
        }

        extractedCount++;
        const percent = Math.floor((extractedCount / totalEntries) * 100);
        this.processingStatus.progress = percent;

        // Log progress every 10%
        if (percent >= lastLoggedPercent + 10) {
          Logger.info('[EXTRACT] Extraction progress', {
            progress: `${percent}%`,
            extracted: `${extractedCount} / ${totalEntries}`,
            currentFile: entry.entryName.length > 50
              ? '...' + entry.entryName.slice(-50)
              : entry.entryName
          });
          lastLoggedPercent = percent;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Get extracted files summary
      const extractedFiles = this.getExtractedFilesSummary(extractDir);

      Logger.info('[EXTRACT] Extraction completed successfully', {
        totalFiles: totalEntries,
        extractedFiles: extractedCount,
        extractionFolder: zipFileNameWithoutExt,
        duration: `${duration}s`,
        jsonFiles: extractedFiles.jsonFiles,
        otherFiles: extractedFiles.otherFiles
      });

      this.processingStatus.currentAction = null;
      this.processingStatus.progress = 100;
      this.processingStatus.lastCompleted = 'extract';

      return {
        status: 'extracted',
        zipFileName,
        extractedPath: extractDir,
        extractedFolder: zipFileNameWithoutExt,
        totalFiles: totalEntries,
        extractedFiles: extractedCount,
        filesSummary: extractedFiles,
        duration: `${duration}s`,
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.processingStatus.currentAction = null;

      Logger.error('[EXTRACT] Extraction failed', {
        error: error.message,
        zipFile: path.basename(zipFilePath)
      });

      throw new Error(`Extraction failed: ${error.message}`);
    }
  }

  // ============================================
  // DATABASE IMPORT METHODS
  // ============================================

  private async cleanDatabase(): Promise<void> {
    try {
      console.log('='.repeat(60));
      console.log('🧹 STARTING DATABASE CLEANUP');
      console.log('='.repeat(60));
      Logger.info('[CLEAN] Starting complete database cleanup');

      const startTime = Date.now();

      // First, check table sizes for estimation
      console.log('📊 Step 1: Analyzing database size...');
      try {
        const [sizeInfo] = await pool.query(`
          SELECT 
            table_name,
            table_rows,
            ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
          FROM information_schema.TABLES 
          WHERE table_schema = DATABASE()
          ORDER BY (data_length + index_length) DESC
        `) as any;

        const totalRows = sizeInfo.reduce((sum: number, t: any) => sum + (t.table_rows || 0), 0);
        const totalSize = sizeInfo.reduce((sum: number, t: any) => sum + (t.size_mb || 0), 0);

        console.log(`   📈 Total estimated rows: ${totalRows.toLocaleString()}`);
        console.log(`   💾 Total database size: ${totalSize.toFixed(2)} MB`);
        console.log(`   ⏱️  Estimated cleanup time: ${Math.ceil(totalRows / 1000)} seconds`);

        // Show largest tables
        console.log('\n   📊 Largest tables:');
        sizeInfo.slice(0, 5).forEach((t: any) => {
          console.log(`      • ${t.table_name}: ${(t.table_rows || 0).toLocaleString()} rows (${t.size_mb} MB)`);
        });
      } catch (err) {
        console.log('   ⚠️  Could not analyze size, continuing...');
      }

      // Disable foreign key checks temporarily
      console.log('\n⚙️  Step 2: Disabling foreign key checks...');
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      console.log('✅ Foreign key checks disabled');

      // Additional optimizations for large datasets
      console.log('\n⚙️  Step 3: Applying performance optimizations...');
      await pool.query('SET SESSION sql_log_bin = 0'); // Disable binary logging if allowed
      await pool.query('SET SESSION unique_checks = 0'); // Disable unique checks
      await pool.query('SET SESSION autocommit = 1'); // Ensure autocommit is on
      console.log('✅ Performance optimizations applied');

      // Truncate all tables in reverse order (to handle foreign keys)
      const tables = [
        // Hotel detail tables first (they have foreign keys to hotels)
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
        // System tables
        'import_logs',
        'processing_queue'
      ];

      console.log(`\n📋 Step 4: Preparing to truncate ${tables.length} tables...`);

      // Execute truncates in parallel batches for maximum speed
      console.log('\n🚀 Step 5: Executing parallel truncate operations...');
      console.log('Progress:\n');
      console.time('⏱️  Total truncate duration');

      let cleaned = 0;
      let failed = 0;
      const batchSize = 10; // Increased batch size for faster processing
      const failedTables: string[] = [];

      for (let i = 0; i < tables.length; i += batchSize) {
        const batch = tables.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(tables.length / batchSize);

        const batchStartTime = Date.now();
        console.log(`📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} tables...`);

        const batchResults = await Promise.allSettled(
          batch.map(async (table) => {
            const tableStartTime = Date.now();
            try {
              // Try TRUNCATE first (faster)
              await pool.query(`TRUNCATE TABLE \`${table}\``);
              const tableDuration = Date.now() - tableStartTime;
              cleaned++;
              const progress = ((cleaned / tables.length) * 100).toFixed(1);
              console.log(`   ✓ [${cleaned}/${tables.length}] ${progress}% - ${table} (${tableDuration}ms)`);
              Logger.info('[CLEAN] Table cleaned', { table, durationMs: tableDuration });
              return { table, success: true, duration: tableDuration };
            } catch (err: any) {
              // If TRUNCATE fails, try DELETE (slower but more reliable)
              try {
                console.log(`   ⚠️  TRUNCATE failed for ${table}, trying DELETE...`);
                await pool.query(`DELETE FROM \`${table}\``);
                const tableDuration = Date.now() - tableStartTime;
                cleaned++;
                const progress = ((cleaned / tables.length) * 100).toFixed(1);
                console.log(`   ✓ [${cleaned}/${tables.length}] ${progress}% - ${table} (${tableDuration}ms, DELETE)`);
                return { table, success: true, duration: tableDuration, method: 'DELETE' };
              } catch (deleteErr: any) {
                failed++;
                failedTables.push(table);
                console.log(`   ✗ Failed - ${table}: ${deleteErr.message}`);
                Logger.warn('[CLEAN] Failed to clean table', { table, error: deleteErr.message });
                return { table, success: false, error: deleteErr.message };
              }
            }
          })
        );

        const batchDuration = Date.now() - batchStartTime;
        const batchSucceeded = batchResults.filter(r => r.status === 'fulfilled').length;

        if (batchSucceeded === batch.length) {
          console.log(`   ✅ Batch ${batchNum} completed in ${(batchDuration / 1000).toFixed(2)}s\n`);
        } else {
          console.log(`   ⚠️  Batch ${batchNum}: ${batchSucceeded}/${batch.length} succeeded (${(batchDuration / 1000).toFixed(2)}s)\n`);
        }
      }

      console.timeEnd('⏱️  Total truncate duration');
      console.log('✅ All tables processed');

      // Re-enable settings
      console.log('\n⚙️  Step 6: Restoring database settings...');
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      await pool.query('SET SESSION unique_checks = 1');
      await pool.query('SET SESSION sql_log_bin = 1');
      console.log('✅ Database settings restored');

      const duration = Date.now() - startTime;

      console.log('\n' + '='.repeat(60));
      if (failed === 0) {
        console.log('✨ DATABASE CLEANUP COMPLETED SUCCESSFULLY');
      } else {
        console.log('⚠️  DATABASE CLEANUP COMPLETED WITH WARNINGS');
      }
      console.log('='.repeat(60));
      console.log(`📊 Statistics:`);
      console.log(`   - Tables cleaned: ${cleaned}/${tables.length}`);
      console.log(`   - Failed: ${failed}`);
      console.log(`   - Success rate: ${((cleaned / tables.length) * 100).toFixed(1)}%`);
      console.log(`   - Total duration: ${(duration / 1000).toFixed(2)} seconds (${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s)`);
      console.log(`   - Average per table: ${(duration / tables.length).toFixed(0)} ms`);

      if (failed > 0) {
        console.log(`\n   ❌ Failed tables:`);
        failedTables.forEach(table => console.log(`      • ${table}`));
      }
      console.log('='.repeat(60));

      Logger.info('[CLEAN] Database cleanup completed', {
        tablesCleaned: cleaned,
        totalTables: tables.length,
        failed,
        successRate: ((cleaned / tables.length) * 100).toFixed(1),
        durationMs: duration,
        durationSec: (duration / 1000).toFixed(2)
      });

      if (failed > 0) {
        console.warn(`\n⚠️  Warning: ${failed} table(s) failed to clean. Review the logs above.`);
      }

    } catch (error: any) {
      console.error('\n' + '='.repeat(60));
      console.error('💥 CRITICAL ERROR: DATABASE CLEANUP FAILED');
      console.error('='.repeat(60));
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
      console.error('='.repeat(60));

      Logger.error('[CLEAN] Database cleanup failed', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Database cleanup failed: ${error.message}`);
    }
  }

  /**
   * Import ALL extracted data to database (Complete Import)
   * @param extractedPath Path to extracted directory
   * @returns Import result with statistics
   */
  async importToDatabase(extractedPath: string): Promise<any> {
    const startTime = Date.now();
    this.processingStatus.currentAction = 'importing';
    this.processingStatus.progress = 0;

    try {
      Logger.info('[IMPORT] Starting COMPLETE database import', { extractedPath });

      // Verify extracted directory exists
      if (!fs.existsSync(extractedPath)) {
        throw new Error(`Extracted directory not found: ${extractedPath}`);
      }

      // STEP 0: Clean entire database before fresh import
      Logger.info('[IMPORT] Step 0/6: Cleaning database (deleting all old data)');
      await this.cleanDatabase();
      Logger.info('[IMPORT] Database cleaned successfully - ready for fresh import');
      this.processingStatus.progress = 1;

      const importResults: any = {
        apiMetadata: { imported: 0, failed: 0, duration: '0s' },
        hotels: { imported: 0, failed: 0, duration: '0s' },
        categories: { imported: 0, failed: 0, duration: '0s' },
        chains: { imported: 0, failed: 0, duration: '0s' },
        destinations: { imported: 0, failed: 0, duration: '0s' },
        hotelDetails: {
          files: 0,
          contracts: 0,
          roomAllocations: 0,
          inventory: 0,
          rates: 0,
          supplements: 0,
          occupancyRules: 0,
          emailSettings: 0,
          rateTags: 0,
          configurations: 0,
          promotions: 0,
          specialRequests: 0,
          groups: 0,
          cancellationPolicies: 0,
          specialConditions: 0,
          roomFeatures: 0,
          pricingRules: 0,
          taxInfo: 0,
          failed: 0,
          duration: '0s'
        }
      };

      // Step 1: Import API Metadata
      Logger.info('[IMPORT] Step 1/6: Importing API metadata');
      this.processingStatus.progress = 2;
      const apiMetadataResult = await this.importAPIMetadata(extractedPath);
      importResults.apiMetadata = apiMetadataResult;
      Logger.info('[IMPORT] API metadata imported', apiMetadataResult);

      // Step 2: Import Hotels (Basic Info)
      Logger.info('[IMPORT] Step 2/6: Importing hotels (basic info)');
      this.processingStatus.progress = 5;
      const hotelsResult = await this.importHotels(extractedPath);
      importResults.hotels = hotelsResult;
      Logger.info('[IMPORT] Hotels imported', hotelsResult);

      // Step 3: Import Categories
      Logger.info('[IMPORT] Step 3/6: Importing categories');
      this.processingStatus.progress = 8;
      const categoriesResult = await this.importCategories(extractedPath);
      importResults.categories = categoriesResult;
      Logger.info('[IMPORT] Categories imported', categoriesResult);

      // Step 4: Import Chains
      Logger.info('[IMPORT] Step 4/6: Importing chains');
      this.processingStatus.progress = 10;
      const chainsResult = await this.importChains(extractedPath);
      importResults.chains = chainsResult;
      Logger.info('[IMPORT] Chains imported', chainsResult);

      // Step 5: Import Destinations (with names)
      Logger.info('[IMPORT] Step 5/6: Importing destinations (with names)');
      this.processingStatus.progress = 12;
      const destinationsResult = await this.importDestinations(extractedPath);
      importResults.destinations = destinationsResult;
      Logger.info('[IMPORT] Destinations imported', destinationsResult);

      // Step 6: Import Hotel Detail Files (150k+ files with ALL sections)
      Logger.info('[IMPORT] Step 6/6: Importing hotel detail files (ALL sections - this will take time...)');
      this.processingStatus.progress = 15;
      const hotelDetailsResult = await this.importHotelDetailFiles(extractedPath);
      importResults.hotelDetails = hotelDetailsResult;
      Logger.info('[IMPORT] Hotel details imported (ALL sections)', hotelDetailsResult);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      const totalRecords =
        importResults.hotels.imported +
        importResults.categories.imported +
        importResults.chains.imported +
        importResults.destinations.imported +
        importResults.hotelDetails.contracts +
        importResults.hotelDetails.rates +
        importResults.hotelDetails.inventory;

      Logger.info('[IMPORT] COMPLETE database import finished successfully', {
        totalRecords,
        hotels: importResults.hotels.imported,
        categories: importResults.categories.imported,
        chains: importResults.chains.imported,
        destinations: importResults.destinations.imported,
        hotelFiles: importResults.hotelDetails.files,
        totalDuration: `${duration}s`
      });

      this.processingStatus.currentAction = null;
      this.processingStatus.progress = 100;
      this.processingStatus.lastCompleted = 'import';

      return {
        status: 'imported',
        results: importResults,
        totalRecords,
        duration: `${duration}s`,
        timestamp: new Date()
      };
    } catch (error: any) {
      this.processingStatus.currentAction = null;

      Logger.error('[IMPORT] Database import failed', {
        error: error.message,
        stack: error.stack
      });

      throw new Error(`Database import failed: ${error.message}`);
    }
  }

  /**
   * Import update data to database (NO database cleanup)
   * @param extractedPath Path to extracted directory
   * @returns Import result with statistics
   */
  async importUpdateToDatabase(extractedPath: string): Promise<any> {
    const startTime = Date.now();
    this.processingStatus.currentAction = 'importing_update';
    this.processingStatus.progress = 0;

    try {
      Logger.info('[IMPORT-UPDATE] Starting UPDATE database import', { extractedPath });

      // Verify extracted directory exists
      if (!fs.existsSync(extractedPath)) {
        throw new Error(`Extracted directory not found: ${extractedPath}`);
      }

      const importResults: any = {
        apiMetadata: { imported: 0, failed: 0, duration: '0s' },
        hotels: { imported: 0, failed: 0, duration: '0s' },
        categories: { imported: 0, failed: 0, duration: '0s' },
        chains: { imported: 0, failed: 0, duration: '0s' },
        destinations: { imported: 0, failed: 0, duration: '0s' },
        hotelDetails: {
          files: 0,
          contracts: 0,
          roomAllocations: 0,
          inventory: 0,
          rates: 0,
          supplements: 0,
          occupancyRules: 0,
          emailSettings: 0,
          rateTags: 0,
          configurations: 0,
          promotions: 0,
          specialRequests: 0,
          groups: 0,
          cancellationPolicies: 0,
          specialConditions: 0,
          roomFeatures: 0,
          pricingRules: 0,
          taxInfo: 0,
          failed: 0,
          duration: '0s'
        }
      };

      // Import API Metadata
      Logger.info('[IMPORT-UPDATE] Step 1: Importing API metadata');
      this.processingStatus.progress = 2;
      importResults.apiMetadata = await this.importAPIMetadata(extractedPath);

      // Import Hotels (Basic Info)
      Logger.info('[IMPORT-UPDATE] Step 2: Importing hotels (basic info)');
      this.processingStatus.progress = 5;
      importResults.hotels = await this.importHotels(extractedPath);

      // Import Categories
      Logger.info('[IMPORT-UPDATE] Step 3: Importing categories');
      this.processingStatus.progress = 8;
      importResults.categories = await this.importCategories(extractedPath);

      // Import Chains
      Logger.info('[IMPORT-UPDATE] Step 4: Importing chains');
      this.processingStatus.progress = 10;
      importResults.chains = await this.importChains(extractedPath);

      // Import Destinations (with names)
      Logger.info('[IMPORT-UPDATE] Step 5: Importing destinations (with names)');
      this.processingStatus.progress = 12;
      importResults.destinations = await this.importDestinations(extractedPath);

      // Import Hotel Detail Files (ALL sections)
      Logger.info('[IMPORT-UPDATE] Step 6: Importing hotel detail files (ALL sections)');
      this.processingStatus.progress = 15;
      importResults.hotelDetails = await this.importHotelDetailFiles(extractedPath);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      const totalRecords =
        importResults.hotels.imported +
        importResults.categories.imported +
        importResults.chains.imported +
        importResults.destinations.imported +
        importResults.hotelDetails.contracts +
        importResults.hotelDetails.rates +
        importResults.hotelDetails.inventory;

      Logger.info('[IMPORT-UPDATE] UPDATE import finished successfully', {
        totalRecords,
        hotels: importResults.hotels.imported,
        categories: importResults.categories.imported,
        chains: importResults.chains.imported,
        destinations: importResults.destinations.imported,
        hotelFiles: importResults.hotelDetails.files,
        totalDuration: `${duration}s`
      });

      this.processingStatus.currentAction = null;
      this.processingStatus.progress = 100;
      this.processingStatus.lastCompleted = 'import_update';

      return {
        status: 'imported_update',
        results: importResults,
        totalRecords,
        duration: `${duration}s`,
        timestamp: new Date()
      };
    } catch (error: any) {
      this.processingStatus.currentAction = null;
      Logger.error('[IMPORT-UPDATE] Database import failed', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Update database import failed: ${error.message}`);
    }
  }

  /**
   * Import hotels from GHOT_F file
   */
  private async importHotels(extractedPath: string): Promise<any> {
    const startTime = Date.now();
    const hotelFile = path.join(extractedPath, 'GENERAL', 'GHOT_F');

    if (!fs.existsSync(hotelFile)) {
      Logger.warn('[IMPORT] Hotels file not found', { path: hotelFile });
      return { imported: 0, failed: 0, duration: '0s' };
    }

    try {
      const fileContent = fs.readFileSync(hotelFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim() && !line.startsWith('{'));

      Logger.info('[IMPORT] Hotels file loaded', {
        totalLines: lines.length,
        file: 'GHOT_F'
      });

      // Batch insert for performance (⚡ OPTIMIZED)
      const BATCH_SIZE = 2000;
      let imported = 0;
      let failed = 0;
      let lastLoggedPercent = 0;

      for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batch = lines.slice(i, i + BATCH_SIZE);
        const values: any[] = [];

        for (const line of batch) {
          try {
            const parts = line.split(':');
            if (parts.length >= 11) {
              values.push([
                parseInt(parts[0]) || 0,
                parts[1] || null,
                parts[2] || null,
                parts[3] || null,
                parts[4] || null,
                parseInt(parts[5]) || 0,
                parts[6] || null,
                parts[7] || null,
                parts[8] || null,
                parseFloat(parts[9]) || null,
                parseFloat(parts[10]) || null,
                parts[11] || null
              ]);
            }
          } catch (error) {
            failed++;
          }
        }

        if (values.length > 0) {
          try {
            const query = `
              INSERT IGNORE INTO hotels 
              (id, category, destination_code, chain_code, accommodation_type, ranking, group_hotel, country_code, state_code, longitude, latitude, name)
              VALUES ?
              ON DUPLICATE KEY UPDATE
                category = VALUES(category),
                destination_code = VALUES(destination_code),
                chain_code = VALUES(chain_code),
                name = VALUES(name)
            `;
            await pool.query(query, [values]);
            imported += values.length;
          } catch (error: any) {
            Logger.error('[IMPORT] Batch insert failed', { error: error.message });
            failed += values.length;
          }
        }

        // Progress logging
        const percent = Math.floor(((i + batch.length) / lines.length) * 100);
        if (percent >= lastLoggedPercent + 10) {
          Logger.info('[IMPORT] Hotels import progress', {
            progress: `${percent}%`,
            imported: `${imported} / ${lines.length}`
          });
          lastLoggedPercent = percent;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        imported,
        failed,
        total: lines.length,
        duration: `${duration}s`
      };
    } catch (error: any) {
      Logger.error('[IMPORT] Hotels import error', { error: error.message });
      throw error;
    }
  }

  /**
   * Import categories from GCAT_F file
   */
  private async importCategories(extractedPath: string): Promise<any> {
    const startTime = Date.now();
    const categoryFile = path.join(extractedPath, 'GENERAL', 'GCAT_F');

    if (!fs.existsSync(categoryFile)) {
      Logger.warn('[IMPORT] Categories file not found', { path: categoryFile });
      return { imported: 0, failed: 0, duration: '0s' };
    }

    try {
      const fileContent = fs.readFileSync(categoryFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim() && !line.startsWith('{'));

      Logger.info('[IMPORT] Categories file loaded', {
        totalLines: lines.length,
        file: 'GCAT_F'
      });

      const BATCH_SIZE = 500; // ⚡ OPTIMIZED
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batch = lines.slice(i, i + BATCH_SIZE);
        const values: any[] = [];

        for (const line of batch) {
          try {
            const parts = line.split(':');
            if (parts.length >= 2) {
              values.push([
                parts[0] || null,
                parts[0]?.split('_')[0] || null,
                parts[1] || null,
                parts[2] || null
              ]);
            }
          } catch (error) {
            failed++;
          }
        }

        if (values.length > 0) {
          try {
            const query = `
              INSERT IGNORE INTO categories (code, type, simple_code, description)
              VALUES ?
              ON DUPLICATE KEY UPDATE description = VALUES(description)
            `;
            await pool.query(query, [values]);
            imported += values.length;
          } catch (error: any) {
            failed += values.length;
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        imported,
        failed,
        total: lines.length,
        duration: `${duration}s`
      };
    } catch (error: any) {
      Logger.error('[IMPORT] Categories import error', { error: error.message });
      throw error;
    }
  }

  /**
   * Import chains from GTTO_F file
   */
  private async importChains(extractedPath: string): Promise<any> {
    const startTime = Date.now();
    const chainFile = path.join(extractedPath, 'GENERAL', 'GTTO_F');

    if (!fs.existsSync(chainFile)) {
      Logger.warn('[IMPORT] Chains file not found', { path: chainFile });
      return { imported: 0, failed: 0, duration: '0s' };
    }

    try {
      const fileContent = fs.readFileSync(chainFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim() && !line.startsWith('{'));

      Logger.info('[IMPORT] Chains file loaded', {
        totalLines: lines.length,
        file: 'GTTO_F'
      });

      const BATCH_SIZE = 500; // ⚡ OPTIMIZED
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batch = lines.slice(i, i + BATCH_SIZE);
        const values: any[] = [];

        for (const line of batch) {
          try {
            const parts = line.split(':');
            if (parts.length >= 2) {
              values.push([
                parts[0] || null,
                parts[1] || null
              ]);
            }
          } catch (error) {
            failed++;
          }
        }

        if (values.length > 0) {
          try {
            const query = `
              INSERT IGNORE INTO chains (code, name)
              VALUES ?
              ON DUPLICATE KEY UPDATE name = VALUES(name)
            `;
            await pool.query(query, [values]);
            imported += values.length;
          } catch (error: any) {
            failed += values.length;
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        imported,
        failed,
        total: lines.length,
        duration: `${duration}s`
      };
    } catch (error: any) {
      Logger.error('[IMPORT] Chains import error', { error: error.message });
      throw error;
    }
  }

  /**
   * Import API metadata from AIF2_F file
   */
  private async importAPIMetadata(extractedPath: string): Promise<any> {
    const startTime = Date.now();
    const apiFile = path.join(extractedPath, 'GENERAL', 'AIF2_F');

    if (!fs.existsSync(apiFile)) {
      Logger.warn('[IMPORT] API metadata file not found', { path: apiFile });
      return { imported: 0, failed: 0, duration: '0s' };
    }

    try {
      const fileContent = fs.readFileSync(apiFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim() && !line.startsWith('{'));

      Logger.info('[IMPORT] API metadata file loaded', {
        totalLines: lines.length,
        file: 'AIF2_F'
      });

      let imported = 0;
      let failed = 0;

      for (const line of lines) {
        try {
          const parts = line.split(':');
          if (parts.length >= 10) {
            // Extract features (last part with key~value pairs)
            const features = parts.slice(10).join(':');

            const query = `
              INSERT IGNORE INTO api_metadata 
              (api_version, total_hotels, environment, region, country, api_type, is_active, timestamp, next_api_version, features)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await pool.query(query, [
              parts[0] || null,    // api_version
              parseInt(parts[1]) || 0,  // total_hotels
              parts[2] || null,    // environment
              parts[3] || null,    // region
              parts[4] || null,    // country
              parts[5] || null,    // api_type
              parts[6] || null,    // is_active
              parts[7] || null,    // timestamp
              parts[9] || null,    // next_api_version
              features || null     // features
            ]);
            imported++;
          }
        } catch (error) {
          failed++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        imported,
        failed,
        total: lines.length,
        duration: `${duration}s`
      };
    } catch (error: any) {
      Logger.error('[IMPORT] API metadata import error', { error: error.message });
      throw error;
    }
  }

  /**
   * Import destinations from IDES_F file (WITH NAMES - 4th field)
   */
  private async importDestinations(extractedPath: string): Promise<any> {
    const startTime = Date.now();
    const destFile = path.join(extractedPath, 'GENERAL', 'IDES_F');

    if (!fs.existsSync(destFile)) {
      Logger.warn('[IMPORT] Destinations file not found', { path: destFile });
      return { imported: 0, failed: 0, duration: '0s' };
    }

    try {
      const fileContent = fs.readFileSync(destFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim() && !line.startsWith('{'));

      Logger.info('[IMPORT] Destinations file loaded', {
        totalLines: lines.length,
        file: 'IDES_F'
      });

      const BATCH_SIZE = 500; // ⚡ OPTIMIZED
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batch = lines.slice(i, i + BATCH_SIZE);
        const values: any[] = [];

        for (const line of batch) {
          try {
            // Clean line from any carriage returns or whitespace
            const cleanLine = line.replace(/\r/g, '').trim();
            const parts = cleanLine.split(':');

            if (parts.length >= 3) {
              const code = parts[0]?.trim() || null;
              const countryCode = parts[1]?.trim() || null;
              const isAvailable = parts[2]?.trim() || null;
              // Name field doesn't exist in IDES_F file, use code as fallback
              const name = parts[3]?.trim() || code;

              values.push([code, countryCode, isAvailable, name]);
            }
          } catch (error) {
            failed++;
          }
        }

        if (values.length > 0) {
          try {
            const query = `
              INSERT IGNORE INTO destinations (code, country_code, is_available, name)
              VALUES ?
              ON DUPLICATE KEY UPDATE 
                country_code = VALUES(country_code),
                name = VALUES(name)
            `;
            await pool.query(query, [values]);
            imported += values.length;
          } catch (error: any) {
            failed += values.length;
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        imported,
        failed,
        total: lines.length,
        duration: `${duration}s`
      };
    } catch (error: any) {
      Logger.error('[IMPORT] Destinations import error', { error: error.message });
      throw error;
    }
  }

  /**
  * Import ALL hotel detail files (150k+ files with complete data)
  */
  private async importHotelDetailFiles(extractedPath: string): Promise<any> {
    const startTime = Date.now();
    const destinationsDir = path.join(extractedPath, 'DESTINATIONS');

    console.log('\n' + '='.repeat(70));
    console.log('🏨 STARTING HOTEL DETAIL FILES IMPORT');
    console.log('='.repeat(70));

    if (!fs.existsSync(destinationsDir)) {
      console.log('❌ Destinations directory not found:', destinationsDir);
      Logger.warn('[IMPORT] Destinations directory not found', { path: destinationsDir });
      return { files: 0, failed: 0, duration: '0s' };
    }

    try {
      // Get all destination folders
      console.log('📂 Step 1: Scanning destinations directory...');
      const destFolders = fs.readdirSync(destinationsDir).filter(f => {
        return fs.lstatSync(path.join(destinationsDir, f)).isDirectory();
      });
      console.log(`✅ Found ${destFolders.length} destination folders`);

      // Count total files for progress tracking
      console.log('\n📊 Step 2: Counting total hotel files...');
      let totalFiles = 0;
      const destFileCounts: { [key: string]: number } = {};

      destFolders.forEach(destFolder => {
        const destPath = path.join(destinationsDir, destFolder);
        const files = fs.readdirSync(destPath).filter(f => {
          return fs.lstatSync(path.join(destPath, f)).isFile();
        });
        destFileCounts[destFolder] = files.length;
        totalFiles += files.length;
      });

      console.log(`✅ Total files to process: ${totalFiles.toLocaleString()}`);
      console.log(`   Average files per destination: ${Math.round(totalFiles / destFolders.length)}`);
      console.log(`   Estimated processing time: ${Math.ceil(totalFiles / 100)} - ${Math.ceil(totalFiles / 50)} minutes`);

      Logger.info('[IMPORT] Starting hotel detail files import', {
        totalDestinations: destFolders.length,
        totalFiles: totalFiles,
        note: 'This will process 150k+ files - will take significant time'
      });

      let processedDestinations = 0;
      let processedFiles = 0;
      let failedFiles = 0;
      let skippedDuplicates = 0;
      const failedFilesList: Array<{ file: string; path: string; error: string }> = [];
      const processedHotelIds = new Set<number>(); // Track processed hotel IDs to detect duplicates

      // ⚡ PERFORMANCE OPTIMIZATION: Disable FK checks for MASSIVE speed boost
      console.log('\n⚙️  Step 3: Applying database performance optimizations...');
      console.log('   • Disabling foreign key checks...');
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      console.log('   • Disabling autocommit for batch transactions...');
      await pool.query('SET AUTOCOMMIT = 0');
      console.log('   • Disabling unique checks...');
      await pool.query('SET UNIQUE_CHECKS = 0');
      console.log('   • Increasing bulk insert buffer...');
      await pool.query('SET SESSION bulk_insert_buffer_size = 256 * 1024 * 1024'); // 256MB
      console.log('   • Disabling binary logging (if permitted)...');
      try {
        await pool.query('SET SESSION sql_log_bin = 0');
        console.log('   ✅ Binary logging disabled');
      } catch {
        console.log('   ⚠️  Binary logging could not be disabled (permissions)');
      }
      console.log('✅ Performance optimizations applied');

      // 🔥🔥🔥 OPTIMIZED BATCH CONFIGURATION for better progress tracking
      const FILE_PARALLEL_BATCH = 200; // Process 200 files at once! 🚀

      // Calculate DEST_PARALLEL_BATCH to create ~200 batches for progress visibility
      const TARGET_BATCHES = 200;
      const MIN_DEST_PER_BATCH = 2;    // Minimum to avoid too much overhead
      const MAX_DEST_PER_BATCH = 50;   // Maximum for reasonable batch sizes

      let DEST_PARALLEL_BATCH = Math.max(
        MIN_DEST_PER_BATCH,
        Math.min(
          MAX_DEST_PER_BATCH,
          Math.ceil(destFolders.length / TARGET_BATCHES)
        )
      );

      // If we have very few destinations, just process 1 at a time for more batches
      if (destFolders.length < TARGET_BATCHES && destFolders.length > 0) {
        DEST_PARALLEL_BATCH = 1;
      }

      console.log('\n🚀 Step 4: Starting parallel import process...');
      console.log(`   Configuration:`);
      console.log(`   • File parallel batch: ${FILE_PARALLEL_BATCH}`);
      console.log(`   • Destination parallel batch: ${DEST_PARALLEL_BATCH}`);
      console.log(`   • Total batches: ~${Math.ceil(destFolders.length / DEST_PARALLEL_BATCH)}`);
      console.log('\n' + '─'.repeat(70));

      const importStartTime = Date.now();
      let lastProgressUpdate = Date.now();
      const progressInterval = 10000; // Update every 10 seconds (less console overhead)

      // Process destinations in parallel batches
      for (let d = 0; d < destFolders.length; d += DEST_PARALLEL_BATCH) {
        const destBatch = destFolders.slice(d, d + DEST_PARALLEL_BATCH);
        const batchNum = Math.floor(d / DEST_PARALLEL_BATCH) + 1;
        const totalBatches = Math.ceil(destFolders.length / DEST_PARALLEL_BATCH);

        const batchStartTime = Date.now();
        console.log(`\n📦 Batch ${batchNum}/${totalBatches}: Processing ${destBatch.length} destinations...`);

        // Process multiple destinations simultaneously
        const destResults = await Promise.allSettled(
          destBatch.map(async (destFolder) => {
            const destPath = path.join(destinationsDir, destFolder);
            const hotelFiles = fs.readdirSync(destPath).filter(f => {
              return fs.lstatSync(path.join(destPath, f)).isFile();
            });

            let destProcessed = 0;
            let destFailed = 0;

            // Process all files in this destination in parallel batches
            for (let i = 0; i < hotelFiles.length; i += FILE_PARALLEL_BATCH) {
              const fileBatch = hotelFiles.slice(i, i + FILE_PARALLEL_BATCH);

              // Use Promise.allSettled for tracking successes and failures
              const fileResults = await Promise.allSettled(
                fileBatch.map(async (hotelFile) => {
                  const filePath = path.join(destPath, hotelFile);
                  const hotelId = this.extractHotelIdFromFilename(hotelFile);

                  if (!hotelId) {
                    throw new Error('Invalid hotel ID');
                  }

                  // Check for duplicate hotel ID
                  if (processedHotelIds.has(hotelId)) {
                    return { hotelId, hotelFile, filePath, isDuplicate: true };
                  }

                  await this.processHotelDetailFile(filePath, hotelId);
                  processedHotelIds.add(hotelId); // Mark as processed
                  return { hotelId, hotelFile, filePath };
                })
              );

              // Count successes and failures
              fileResults.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                  const fileResult = result.value;
                  if (fileResult.isDuplicate) {
                    skippedDuplicates++;
                    // Log skipped duplicate (only to logger, not console for speed)
                    Logger.info(`[IMPORT] Duplicate hotel detected - skipping`, {
                      hotelId: fileResult.hotelId,
                      file: fileResult.hotelFile,
                      destination: destFolder
                    });
                  } else {
                    destProcessed++;
                  }
                } else {
                  destFailed++;
                  // Log failed file details (only to logger, not console for speed)
                  const failedFile = fileBatch[idx];
                  const failedPath = path.join(destPath, failedFile);
                  const errorMsg = result.reason?.message || 'Unknown error';

                  // Only log to file, not console (for speed)
                  Logger.warn(`[IMPORT] File processing failed`, {
                    file: failedFile,
                    path: failedPath,
                    destination: destFolder,
                    error: errorMsg
                  });

                  // Track failed files for summary (limit to first 100 for memory)
                  if (failedFilesList.length < 100) {
                    failedFilesList.push({
                      file: failedFile,
                      path: failedPath,
                      error: errorMsg
                    });
                  }
                }
              });

              // Real-time progress update (throttled)
              const now = Date.now();
              if (now - lastProgressUpdate > progressInterval) {
                const currentProcessed = processedFiles + destProcessed;
                const progress = ((currentProcessed / totalFiles) * 100).toFixed(1);
                const elapsed = (now - importStartTime) / 1000;
                const rate = currentProcessed / elapsed;
                const remaining = (totalFiles - currentProcessed) / rate;

                console.log(`   📈 Progress: ${currentProcessed.toLocaleString()}/${totalFiles.toLocaleString()} (${progress}%) | Rate: ${rate.toFixed(0)} files/sec | ETA: ${Math.ceil(remaining / 60)}min`);
                lastProgressUpdate = now;
              }
            }

            return {
              destination: destFolder,
              processed: destProcessed,
              failed: destFailed,
              total: hotelFiles.length
            };
          })
        );

        // Aggregate batch results
        let batchProcessed = 0;
        let batchFailed = 0;

        destResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            batchProcessed += result.value.processed;
            batchFailed += result.value.failed;
            // Reduced per-destination logging for speed
          } else {
            const destFolder = destBatch[idx];
            console.log(`   ✗ ${destFolder}: Failed - ${result.reason?.message || 'Unknown error'}`);
          }
        });

        processedFiles += batchProcessed;
        failedFiles += batchFailed;
        processedDestinations += destBatch.length;

        const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
        const batchRate = (batchProcessed / parseFloat(batchDuration)).toFixed(0);

        console.log(`   ✅ Batch ${batchNum} completed in ${batchDuration}s (${batchRate} files/sec)`);
        console.log(`   📊 Batch Stats: ${batchProcessed} processed, ${batchFailed} failed, ${skippedDuplicates} duplicates skipped`);

        // Commit every 20 batches to reduce overhead with many batches
        if (batchNum % 20 === 0) {
          console.log(`   💾 Committing transaction (Batch ${batchNum})...`);
          await pool.query('COMMIT');
          await pool.query('SET AUTOCOMMIT = 0');
          console.log(`   ✅ Committed`);
        }

        // Overall progress summary every 10 batches for better visibility
        if (batchNum % 10 === 0) {
          const overallProgress = ((processedFiles / totalFiles) * 100).toFixed(1);
          const elapsedMinutes = ((Date.now() - importStartTime) / 60000).toFixed(1);
          const currentRate = (processedFiles / ((Date.now() - importStartTime) / 1000)).toFixed(0);
          const etaMinutes = Math.ceil(((totalFiles - processedFiles) / parseFloat(currentRate)) / 60);
          console.log('\n' + '─'.repeat(70));
          console.log(`📊 CHECKPOINT (Batch ${batchNum}/${totalBatches})`);
          console.log(`   Progress: ${processedFiles.toLocaleString()}/${totalFiles.toLocaleString()} (${overallProgress}%)`);
          console.log(`   Speed: ${currentRate} files/sec | ETA: ${etaMinutes}min | Failed: ${failedFiles.toLocaleString()} | Duplicates: ${skippedDuplicates.toLocaleString()}`);
          console.log('─'.repeat(70) + '\n');
        }
      }

      // ⚡ Re-enable FK checks and commit final batch
      console.log('\n⚙️  Step 5: Restoring database settings...');
      console.log('   • Committing final transactions...');
      await pool.query('COMMIT');
      console.log('   • Re-enabling autocommit...');
      await pool.query('SET AUTOCOMMIT = 1');
      console.log('   • Re-enabling foreign key checks...');
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('   • Re-enabling unique checks...');
      await pool.query('SET UNIQUE_CHECKS = 1');
      console.log('   • Re-enabling binary logging...');
      try {
        await pool.query('SET SESSION sql_log_bin = 1');
      } catch {
        // Ignore if not available
      }
      console.log('✅ Database settings restored');

      const duration = ((Date.now() - startTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const avgRate = (processedFiles / duration).toFixed(1);

      console.log('\n' + '='.repeat(70));
      console.log('✨ HOTEL DETAIL FILES IMPORT COMPLETED!');
      console.log('='.repeat(70));
      console.log('📊 Final Statistics:');
      console.log(`   ✅ Total files processed: ${processedFiles.toLocaleString()}/${totalFiles.toLocaleString()}`);
      console.log(`   ❌ Failed files: ${failedFiles.toLocaleString()}`);
      console.log(`   ⏭️  Duplicate files skipped: ${skippedDuplicates.toLocaleString()}`);
      console.log(`   📂 Destinations processed: ${processedDestinations}/${destFolders.length}`);
      console.log(`   📈 Success rate: ${((processedFiles / totalFiles) * 100).toFixed(2)}%`);
      console.log(`   ⏱️  Total duration: ${minutes}m ${seconds}s`);
      console.log(`   ⚡ Average speed: ${avgRate} files/second`);
      console.log(`   💾 Data throughput: ${((processedFiles * 5) / 1024).toFixed(2)} MB (estimated)`);

      // Show failed files summary if any
      if (failedFilesList.length > 0) {
        console.log('\n' + '─'.repeat(70));
        console.log(`⚠️  FAILED FILES SUMMARY (showing first ${failedFilesList.length} failures):`);
        console.log('─'.repeat(70));
        failedFilesList.forEach((failed, idx) => {
          console.log(`   ${idx + 1}. ${failed.file}`);
          console.log(`      Path: ${failed.path}`);
          console.log(`      Error: ${failed.error}`);
        });
        if (failedFiles > failedFilesList.length) {
          console.log(`\n   ... and ${failedFiles - failedFilesList.length} more failed files (check logs for details)`);
        }
        console.log('─'.repeat(70));
      }

      console.log('='.repeat(70));

      Logger.info('[IMPORT] Hotel details import completed!', {
        totalDestinations: destFolders.length,
        processedDestinations,
        totalFiles,
        processedFiles,
        failedFiles,
        skippedDuplicates,
        failedFilesSample: failedFilesList.slice(0, 10).map(f => f.file), // First 10 failed files
        totalDuration: `${minutes}m ${seconds}s`,
        avgRate: `${avgRate} files/sec`
      });

      return {
        files: processedFiles,
        failed: failedFiles,
        duplicates: skippedDuplicates,
        destinations: processedDestinations,
        duration: `${minutes}m ${seconds}s`,
        avgRate: `${avgRate} files/sec`
      };
    } catch (error: any) {
      console.error('\n' + '='.repeat(70));
      console.error('💥 CRITICAL ERROR: HOTEL DETAILS IMPORT FAILED');
      console.error('='.repeat(70));
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      console.error('='.repeat(70));

      Logger.error('[IMPORT] Hotel details import error', { error: error.message });
      throw error;
    }
  }

  /**
   * Process single hotel detail file and extract ALL sections (18 sections)
   */
  private async processHotelDetailFile(filePath: string, hotelId: number): Promise<any> {
    const stats = {
      contracts: 0,
      roomAllocations: 0,
      inventory: 0,
      rates: 0,
      supplements: 0,
      occupancyRules: 0,
      emailSettings: 0,
      rateTags: 0,
      configurations: 0,
      promotions: 0,
      specialRequests: 0,
      groups: 0,
      cancellationPolicies: 0,
      specialConditions: 0,
      roomFeatures: 0,
      pricingRules: 0,
      taxInfo: 0
    };

    try {
      // Log file being processed (verbose - can be removed later)
      // Logger.debug(`[IMPORT] Processing hotel file: ${filePath} (Hotel ID: ${hotelId})`);

      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse different sections
      const sections = this.parseHotelFileSections(content);

      // 🔥 PARALLEL EXECUTION - All sections at once! ⚡
      const results = await Promise.all([
        sections.CCON?.length ? this.importContracts(hotelId, sections.CCON) : Promise.resolve(0),
        sections.CNHA?.length ? this.importRoomAllocations(hotelId, sections.CNHA) : Promise.resolve(0),
        sections.CNIN?.length ? this.importInventory(hotelId, sections.CNIN) : Promise.resolve(0),
        sections.CNCT?.length ? this.importRates(hotelId, sections.CNCT) : Promise.resolve(0),
        sections.CNSU?.length ? this.importSupplements(hotelId, sections.CNSU) : Promise.resolve(0),
        sections.CNOE?.length ? this.importOccupancyRules(hotelId, sections.CNOE) : Promise.resolve(0),
        sections.CNEM?.length ? this.importEmailSettings(hotelId, sections.CNEM) : Promise.resolve(0),
        sections.CNTA?.length ? this.importRateTags(hotelId, sections.CNTA) : Promise.resolve(0),
        sections.CNCF?.length ? this.importConfigurations(hotelId, sections.CNCF) : Promise.resolve(0),
        sections.CNPV?.length ? this.importPromotions(hotelId, sections.CNPV) : Promise.resolve(0),
        sections.CNSR?.length ? this.importSpecialRequests(hotelId, sections.CNSR) : Promise.resolve(0),
        sections.CNGR?.length ? this.importGroups(hotelId, sections.CNGR) : Promise.resolve(0),
        sections.CNCL?.length ? this.importCancellationPolicies(hotelId, sections.CNCL) : Promise.resolve(0),
        sections.CNES?.length ? this.importSpecialConditions(hotelId, sections.CNES) : Promise.resolve(0),
        sections.CNHF?.length ? this.importRoomFeatures(hotelId, sections.CNHF) : Promise.resolve(0),
        sections.CNPR?.length ? this.importPricingRules(hotelId, sections.CNPR) : Promise.resolve(0),
        sections.ATAX?.length ? this.importTaxInfo(hotelId, sections.ATAX) : Promise.resolve(0)
      ]);

      // Map results to stats
      stats.contracts = results[0];
      stats.roomAllocations = results[1];
      stats.inventory = results[2];
      stats.rates = results[3];
      stats.supplements = results[4];
      stats.occupancyRules = results[5];
      stats.emailSettings = results[6];
      stats.rateTags = results[7];
      stats.configurations = results[8];
      stats.promotions = results[9];
      stats.specialRequests = results[10];
      stats.groups = results[11];
      stats.cancellationPolicies = results[12];
      stats.specialConditions = results[13];
      stats.roomFeatures = results[14];
      stats.pricingRules = results[15];
      stats.taxInfo = results[16];

      return stats;
    } catch (error: any) {
      // Log which file failed for debugging (only to file, not console for speed)
      Logger.error(`[IMPORT] Failed to process hotel file: ${filePath}`, {
        hotelId,
        filePath,
        error: error.message,
        stack: error.stack
      });
      throw error; // Propagate error to track failures
    }
  }

  /**
   * Parse hotel file into sections
   */
  private parseHotelFileSections(content: string): any {
    const sections: any = {};

    const sectionRegex = /\{([A-Z]+)\}([\s\S]*?)\{\/\1\}/g;
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
      const sectionName = match[1];
      const sectionContent = match[2].trim();

      if (sectionContent) {
        sections[sectionName] = sectionContent.split('\n').filter(line => line.trim());
      }
    }

    return sections;
  }

  /**
   * Extract hotel ID from filename
   */
  private extractHotelIdFromFilename(filename: string): number | null {
    // Filename format examples:
    // - Standard format: "461_8831_O_F" -> parts: [461, 8831, O, F] -> hotel ID is 8831 (second numeric part)
    // - Standard format: "246_8547_M_F" -> parts: [246, 8547, M, F] -> hotel ID is 8547 (second numeric part)
    // - Standard format: "1147_1027_M_F" -> parts: [1147, 1027, M, F] -> hotel ID is 1027 (second numeric part)
    // - B2B with #: "ID_B2B_97#APBFA0_890932_1_M_F" -> hotel ID is 890932

    // Split by underscore
    const parts = filename.split('_');

    // Standard format: {destination_code}_{hotel_id}_{type}_{flag}
    // The hotel ID is typically the second numeric part
    if (parts.length >= 4) {
      // Check if second part is numeric (this should be the hotel ID)
      const secondPart = parts[1];
      if (/^\d+$/.test(secondPart)) {
        const hotelId = parseInt(secondPart);
        if (hotelId > 0) {
          return hotelId;
        }
      }
    }

    // Fallback 1: Find all numeric parts and use the second one if available
    const numericParts = parts.filter(part => /^\d+$/.test(part));
    if (numericParts.length >= 2) {
      const hotelId = parseInt(numericParts[1]);
      if (hotelId > 0) {
        return hotelId;
      }
    }

    // Fallback 2: Find the largest numeric part (likely to be hotel ID)
    if (numericParts.length > 0) {
      const largestNumeric = numericParts
        .map(p => parseInt(p))
        .filter(n => n > 0)
        .sort((a, b) => b - a)[0];
      if (largestNumeric) {
        return largestNumeric;
      }
    }

    // Last resort: try to extract any sequence of digits
    const match = filename.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Import contracts (CCON section) - ⚡ STREAMING: Direct insert, no memory accumulation
   */
  private async importContracts(hotelId: number, lines: string[]): Promise<number> {
    if (!lines || lines.length === 0) return 0;

    try {
      const MICRO_BATCH = 10000; // 🔥🔥🔥 ULTRA MODE: 10K RECORDS PER QUERY!
      let imported = 0;

      for (let i = 0; i < lines.length; i += MICRO_BATCH) {
        const batch = lines.slice(i, i + MICRO_BATCH);
        const values: any[] = [];

        for (const line of batch) {
          const parts = line.split(':');
          if (parts.length >= 13) {
            // 🔥 FIX: Correct field positions based on actual data format
            // Format: N:dest:contract:rate:board:type:?:id::date_from:date_to:?:currency:board_type:...
            values.push([
              hotelId,
              parts[1] || null,   // destination_code
              parts[2] || null,   // contract_code
              parts[3] || null,   // rate_code
              parts[4] || null,   // board_code
              parts[5] || null,   // contract_type
              parts[9] || null,   // date_from
              parts[10] || null,  // date_to
              parts[12] || null,  // currency
              parts[13] || null   // board_type
            ]);
          }
        }

        if (values.length > 0) {
          await pool.query(`INSERT IGNORE INTO hotel_contracts (hotel_id, destination_code, contract_code, rate_code, board_code, contract_type, date_from, date_to, currency, board_type) VALUES ?`, [values]);
          imported += values.length;
        }
      }

      return imported;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import room allocations (CNHA section) - ⚡ STREAMING
   */
  private async importRoomAllocations(hotelId: number, lines: string[]): Promise<number> {
    if (!lines || lines.length === 0) return 0;

    try {
      const MICRO_BATCH = 10000; // 🔥🔥🔥 ULTRA MODE: 10K RECORDS PER QUERY!
      let imported = 0;

      for (let i = 0; i < lines.length; i += MICRO_BATCH) {
        const values: any[] = [];
        const batch = lines.slice(i, i + MICRO_BATCH);

        for (const line of batch) {
          const parts = line.split(':');
          if (parts.length >= 8) {
            values.push([hotelId, parts[0] || null, parts[1] || null, parseInt(parts[2]) || 0, parseInt(parts[3]) || 0, parseInt(parts[4]) || 0, parseInt(parts[5]) || 0, parseInt(parts[6]) || 0, parseInt(parts[7]) || 0, parseInt(parts[8]) || 0]);
          }
        }

        if (values.length > 0) {
          await pool.query(`INSERT IGNORE INTO hotel_room_allocations (hotel_id, room_code, board_code, min_adults, max_adults, min_children, max_children, min_pax, max_pax, allocation) VALUES ?`, [values]);
          imported += values.length;
        }
      }

      return imported;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import inventory/availability data (CNIN section) - ⚡ STREAMING
   */
  private async importInventory(hotelId: number, lines: string[]): Promise<number> {
    if (!lines || lines.length === 0) return 0;

    try {
      const MICRO_BATCH = 10000; // 🔥🔥🔥 ULTRA MODE: 10K RECORDS PER QUERY!
      let imported = 0;

      for (let i = 0; i < lines.length; i += MICRO_BATCH) {
        const values: any[] = [];
        const batch = lines.slice(i, i + MICRO_BATCH);

        for (const line of batch) {
          const parts = line.split(':');
          if (parts.length >= 5) {
            values.push([hotelId, parts[2] || null, parts[3] || null, parts[0] || null, parts[1] || null, parts[4] || null]);
          }
        }

        if (values.length > 0) {
          await pool.query(`INSERT IGNORE INTO hotel_inventory (hotel_id, room_code, board_code, date_from, date_to, availability_data) VALUES ?`, [values]);
          imported += values.length;
        }
      }

      return imported;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import rates/pricing data (CNCT section) - ⚡ STREAMING (MOST DATA)
   */
  private async importRates(hotelId: number, lines: string[]): Promise<number> {
    if (!lines || lines.length === 0) return 0;

    try {
      const MICRO_BATCH = 10000; // 🔥🔥🔥 ULTRA MODE: 10K RECORDS PER QUERY! (rates have most data)
      let imported = 0;

      for (let i = 0; i < lines.length; i += MICRO_BATCH) {
        const values: any[] = [];
        const batch = lines.slice(i, i + MICRO_BATCH);

        for (const line of batch) {
          const parts = line.split(':');
          if (parts.length >= 7) {
            // 🔥 FIX: Rates data is at parts[6], not parts[7]!
            // Format: date_from:date_to:room_code:board_code:::rate_tuples
            const ratesString = parts[6] || ''; // Rates are at position 6

            // Extract all rate tuples
            const rateMatches = ratesString.matchAll(/\(([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^)]+)\)/g);

            for (const rateMatch of rateMatches) {
              values.push([
                hotelId,
                parts[2] || null,  // room_code
                parts[3] || null,  // board_code
                parts[0] || null,  // date_from
                parts[1] || null,  // date_to
                rateMatch[1] || null,  // rate_type
                parseFloat(rateMatch[2]) || 0,  // base_price
                parseFloat(rateMatch[3]) || 0,  // tax_amount
                parseInt(rateMatch[4]) || 0,    // adults
                rateMatch[5] || null,            // board_type
                parseFloat(rateMatch[6]) || 0    // price
              ]);
            }
          }
        }

        if (values.length > 0) {
          await pool.query(`INSERT IGNORE INTO hotel_rates (hotel_id, room_code, board_code, date_from, date_to, rate_type, base_price, tax_amount, adults, board_type, price) VALUES ?`, [values]);
          imported += values.length;
        }
      }

      return imported;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import supplements/offers (CNSU section)
   */
  private async importSupplements(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 6) {
          values.push([
            hotelId,
            parts[0] || null,  // date_from
            parts[1] || null,  // date_to
            parts[3] || null,  // supplement_code
            parts[4] || null,  // supplement_type
            parseFloat(parts[6]) || 0,  // discount_percent
            parseInt(parts[8]) || 0     // min_nights
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_supplements 
          (hotel_id, date_from, date_to, supplement_code, supplement_type, discount_percent, min_nights)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import occupancy rules (CNOE section)
   */
  private async importOccupancyRules(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 3) {
          values.push([
            hotelId,
            parts[0] || null,  // rule_from
            parts[1] || null,  // rule_to
            parts[2] || null   // is_allowed
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_occupancy_rules 
          (hotel_id, rule_from, rule_to, is_allowed)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import email settings (CNEM section)
   */
  private async importEmailSettings(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 7) {
          // 🔥 FIX: room_code is at parts[6], not parts[4]
          // Format: :date_from:date_to:type::room_type:room_code::...
          values.push([
            hotelId,
            parts[1] || null,  // date_from
            parts[2] || null,  // date_to
            parts[3] || null,  // notification_type
            parts[6] || null   // room_code
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_email_settings 
          (hotel_id, date_from, date_to, notification_type, room_code)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import rate tags (CNTA section)
   */
  private async importRateTags(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          values.push([
            hotelId,
            parseInt(parts[0]) || 0,  // tag_id
            parts[1] || null          // tag_name
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_rate_tags
          (hotel_id, tag_id, tag_name)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import configurations (CNCF section)
   * Format: :date_from:date_to::criteria_id:flag:val1:val2:val3:val4::lang
   */
  private async importConfigurations(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 11) {
          values.push([
            hotelId,
            parts[1] || null,  // date_from
            parts[2] || null,  // date_to
            parseInt(parts[4]) || 0,  // criteria_id
            parseInt(parts[5]) || 0,  // flag1
            parseFloat(parts[6]) || 0,  // value1
            parseFloat(parts[7]) || 0,  // value2
            parseFloat(parts[8]) || 0,  // value3
            parseFloat(parts[9]) || 0,  // value4
            parts[11] || null   // language
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_configurations
          (hotel_id, date_from, date_to, criteria_id, flag1, value1, value2, value3, value4, language)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import promotions (CNPV section)
   */
  private async importPromotions(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        if (line.trim()) {
          values.push([
            hotelId,
            line  // promotion_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_promotions
          (hotel_id, promotion_data)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import special requests (CNSR section)
   */
  private async importSpecialRequests(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        if (line.trim()) {
          values.push([
            hotelId,
            line  // request_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_special_requests
            (hotel_id, request_data)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import groups (CNGR section)
   */
  private async importGroups(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        if (line.trim()) {
          values.push([
            hotelId,
            line  // group_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_groups
          (hotel_id, group_data)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import cancellation policies (CNCL section)
   */
  private async importCancellationPolicies(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 5) {
          values.push([
            hotelId,
            parts[0] || null,  // policy_code
            parts[1] || null,  // date_from
            parts[2] || null,  // date_to
            parts[3] || null,  // penalty_type
            parseFloat(parts[4]) || 0,  // penalty_amount
            parseInt(parts[5]) || 0,  // cancellation_hours
            line  // policy_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_cancellation_policies
          (hotel_id, policy_code, date_from, date_to, penalty_type, penalty_amount, cancellation_hours, policy_data)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import special conditions (CNES section)
   */
  private async importSpecialConditions(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 4) {
          values.push([
            hotelId,
            parts[0] || null,  // condition_type
            parts[1] || null,  // condition_code
            parts[2] || null,  // condition_text
            parts[3] || null,  // date_from
            parts[4] || null   // date_to
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_special_conditions
          (hotel_id, condition_type, condition_code, condition_text, date_from, date_to)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import room features (CNHF section)
   */
  private async importRoomFeatures(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 4) {
          values.push([
            hotelId,
            parts[0] || null,  // room_code
            parts[1] || null,  // feature_code
            parts[2] || null,  // feature_type
            parts[3] || null   // feature_value
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_room_features
          (hotel_id, room_code, feature_code, feature_type, feature_value)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import pricing rules (CNPR section)
   */
  private async importPricingRules(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 6) {
          values.push([
            hotelId,
            parts[0] || null,  // rule_code
            parts[1] || null,  // rule_type
            parts[2] || null,  // modifier_type
            parseFloat(parts[3]) || 0,  // modifier_value
            parts[4] || null,  // date_from
            parts[5] || null,  // date_to
            line  // rule_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_pricing_rules
          (hotel_id, rule_code, rule_type, modifier_type, modifier_value, date_from, date_to, rule_data)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Import tax information (ATAX section)
   */
  private async importTaxInfo(hotelId: number, lines: string[]): Promise<number> {
    try {
      const values: any[] = [];

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 6) {
          values.push([
            hotelId,
            parts[0] || null,  // tax_type
            parts[1] || null,  // tax_code
            parseFloat(parts[2]) || 0,  // tax_rate
            parseFloat(parts[3]) || 0,  // tax_amount
            parts[4] || null,  // is_included
            parts[5] || null,  // date_from
            parts[6] || null,  // date_to
            line  // tax_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_tax_info
          (hotel_id, tax_type, tax_code, tax_rate, tax_amount, is_included, date_from, date_to, tax_data)
          VALUES ?
        `;
        await pool.query(query, [values]);
      }

      return values.length;
    } catch (error) {
      return 0;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get summary of extracted files
   * @param extractDir Directory path to scan
   * @returns File summary with counts and names
   */
  private getExtractedFilesSummary(extractDir: string): any {
    try {
      const files = fs.readdirSync(extractDir);
      const jsonFiles: string[] = [];
      const otherFiles: string[] = [];

      files.forEach(file => {
        const fullPath = path.join(extractDir, file);
        if (fs.lstatSync(fullPath).isFile()) {
          if (file.endsWith('.json')) {
            jsonFiles.push(file);
          } else {
            otherFiles.push(file);
          }
        }
      });

      return {
        total: files.length,
        jsonFiles: jsonFiles.length,
        otherFiles: otherFiles.length,
        jsonFileNames: jsonFiles,
        otherFileNames: otherFiles
      };
    } catch (error) {
      return {
        total: 0,
        jsonFiles: 0,
        otherFiles: 0,
        jsonFileNames: [],
        otherFileNames: []
      };
    }
  }

  // ============================================
  // GET/READ METHODS WITH PAGINATION
  // ============================================

  /**
   * Build WHERE clause for hotel filters
   */
  private buildHotelFiltersWhereClause(filters?: any): { whereClause: string; params: any[] } {
    let whereClause = '';
    const params: any[] = [];

    if (filters?.destination_code) {
      whereClause = 'WHERE destination_code = ?';
      params.push(filters.destination_code);
    }

    if (filters?.category) {
      whereClause += whereClause ? ' AND category = ?' : 'WHERE category = ?';
      params.push(filters.category);
    }

    if (filters?.chain_code) {
      whereClause += whereClause ? ' AND chain_code = ?' : 'WHERE chain_code = ?';
      params.push(filters.chain_code);
    }

    if (filters?.country_code) {
      whereClause += whereClause ? ' AND country_code = ?' : 'WHERE country_code = ?';
      params.push(filters.country_code);
    }

    if (filters?.name) {
      whereClause += whereClause ? ' AND name LIKE ?' : 'WHERE name LIKE ?';
      params.push(`%${filters.name}%`);
    }

    return { whereClause, params };
  }

  /**
   * Get hotels with optional pagination
   * If page/limit not provided, returns all hotels
   */
  async getHotels(page?: number, limit?: number, filters?: any): Promise<any> {
    try {
      // Build WHERE clause
      const { whereClause, params } = this.buildHotelFiltersWhereClause(filters);

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM hotels ${whereClause}`;
      const [countResult]: any = await pool.query(countQuery, params);
      const total = countResult[0].total;

      // Check if pagination is requested
      if (page !== undefined && limit !== undefined) {
        // PAGINATED RESPONSE
        const offset = (page - 1) * limit;

        const dataQuery = `
          SELECT 
            id, category, destination_code, chain_code, accommodation_type, 
            ranking, group_hotel, country_code, state_code, 
            longitude, latitude, name
          FROM hotels 
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
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          }
        };
      } else {
        // ALL RECORDS (NO PAGINATION)
        const dataQuery = `
          SELECT 
            id, category, destination_code, chain_code, accommodation_type, 
            ranking, group_hotel, country_code, state_code, 
            longitude, latitude, name
          FROM hotels 
          ${whereClause}
          ORDER BY id ASC
        `;
        const [rows]: any = await pool.query(dataQuery, params);

        return {
          data: rows,
          total,
          count: rows.length
        };
      }
    } catch (error: any) {
      Logger.error('[REPO] Error fetching hotels', { error: error.message });
      throw error;
    }
  }

  /**
   * Get single hotel by ID (basic info only)
   */
  async getHotelById(hotelId: number): Promise<any> {
    try {
      const query = `
        SELECT 
          id, category, destination_code, chain_code, accommodation_type, 
          ranking, group_hotel, country_code, state_code, 
          longitude, latitude, name
        FROM hotels 
        WHERE id = ?
      `;
      const [rows]: any = await pool.query(query, [hotelId]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error: any) {
      Logger.error('[REPO] Error fetching hotel by ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Get hotel with COMPLETE details (ALL data, NO limits) - FIXED VERSION
   */
  async getHotelFullDetails(hotelId: number): Promise<any> {
    try {
      // Step 1: Get hotel basic info
      const hotelQuery = `SELECT id, category, destination_code, chain_code, accommodation_type, ranking, group_hotel, country_code, state_code, longitude, latitude, name FROM hotels WHERE id = ?`;
      const [hotelRows]: any = await pool.query(hotelQuery, [hotelId]);

      if (hotelRows.length === 0) {
        return null;
      }

      const hotel = hotelRows[0];

      // Step 2: Fetch ALL related data in parallel (17 tables)
      const results = await Promise.all([
        pool.query(`SELECT id, room_code, board_code, min_adults, max_adults, min_children, max_children, min_pax, max_pax, allocation FROM hotel_room_allocations WHERE hotel_id = ? ORDER BY room_code`, [hotelId]),
        pool.query(`SELECT id, room_code, board_code, date_from, date_to, rate_type, base_price, tax_amount, adults, board_type, price FROM hotel_rates WHERE hotel_id = ? ORDER BY date_from DESC`, [hotelId]),
        pool.query(`SELECT id, room_code, board_code, date_from, date_to, availability_data FROM hotel_inventory WHERE hotel_id = ? ORDER BY date_from DESC`, [hotelId]),
        pool.query(`SELECT id, destination_code, contract_code, rate_code, board_code, contract_type, date_from, date_to, currency, board_type FROM hotel_contracts WHERE hotel_id = ? ORDER BY date_from DESC`, [hotelId]),
        pool.query(`SELECT id, policy_code, date_from, date_to, penalty_type, penalty_amount, cancellation_hours, policy_data FROM hotel_cancellation_policies WHERE hotel_id = ? ORDER BY date_from DESC`, [hotelId]),
        pool.query(`SELECT id, date_from, date_to, supplement_code, supplement_type, discount_percent, min_nights FROM hotel_supplements WHERE hotel_id = ? ORDER BY date_from DESC`, [hotelId]),
        pool.query(`SELECT id, tag_id, tag_name FROM hotel_rate_tags WHERE hotel_id = ?`, [hotelId]),
        pool.query(`SELECT id, rule_from, rule_to, is_allowed FROM hotel_occupancy_rules WHERE hotel_id = ?`, [hotelId]),
        pool.query(`SELECT id, date_from, date_to, notification_type, room_code FROM hotel_email_settings WHERE hotel_id = ?`, [hotelId]),
        pool.query(`SELECT id, date_from, date_to, criteria_id, flag1, value1, value2, value3, value4, language FROM hotel_configurations WHERE hotel_id = ?`, [hotelId]),
        pool.query(`SELECT id, promotion_data FROM hotel_promotions WHERE hotel_id = ?`, [hotelId]),
        pool.query(`SELECT id, request_data FROM hotel_special_requests WHERE hotel_id = ?`, [hotelId]),
        pool.query(`SELECT id, group_data FROM hotel_groups WHERE hotel_id = ?`, [hotelId]),
        pool.query(`SELECT id, condition_type, condition_code, condition_text, date_from, date_to FROM hotel_special_conditions WHERE hotel_id = ?`, [hotelId]),
        pool.query(`SELECT id, room_code, feature_code, feature_type, feature_value FROM hotel_room_features WHERE hotel_id = ? ORDER BY room_code`, [hotelId]),
        pool.query(`SELECT id, rule_code, rule_type, modifier_type, modifier_value, date_from, date_to, rule_data FROM hotel_pricing_rules WHERE hotel_id = ? ORDER BY date_from DESC`, [hotelId]),
        pool.query(`SELECT id, tax_type, tax_code, tax_rate, tax_amount, is_included, date_from, date_to, tax_data FROM hotel_tax_info WHERE hotel_id = ?`, [hotelId])
      ]);

      // Extract data from query results (first element is the rows array)
      const rooms: any = results[0][0];
      const rates: any = results[1][0];
      const inventory: any = results[2][0];
      const contracts: any = results[3][0];
      const cancellationPolicies: any = results[4][0];
      const supplements: any = results[5][0];
      const rateTags: any = results[6][0];
      const occupancyRules: any = results[7][0];
      const emailSettings: any = results[8][0];
      const configurations: any = results[9][0];
      const promotions: any = results[10][0];
      const specialRequests: any = results[11][0];
      const groups: any = results[12][0];
      const specialConditions: any = results[13][0];
      const roomFeatures: any = results[14][0];
      const pricingRules: any = results[15][0];
      const taxInfo: any = results[16][0];

      return {
        ...hotel,
        details: {
          rooms: rooms || [],
          rates: rates || [],
          inventory: inventory || [],
          contracts: contracts || [],
          cancellationPolicies: cancellationPolicies || [],
          supplements: supplements || [],
          rateTags: rateTags || [],
          occupancyRules: occupancyRules || [],
          emailSettings: emailSettings || [],
          configurations: configurations || [],
          promotions: promotions || [],
          specialRequests: specialRequests || [],
          groups: groups || [],
          specialConditions: specialConditions || [],
          roomFeatures: roomFeatures || [],
          pricingRules: pricingRules || [],
          taxInfo: taxInfo || []
        },
        summary: {
          totalRooms: (rooms || []).length,
          totalRates: (rates || []).length,
          totalInventory: (inventory || []).length,
          totalContracts: (contracts || []).length,
          totalCancellationPolicies: (cancellationPolicies || []).length,
          totalSupplements: (supplements || []).length,
          totalRateTags: (rateTags || []).length,
          totalOccupancyRules: (occupancyRules || []).length,
          totalEmailSettings: (emailSettings || []).length,
          totalConfigurations: (configurations || []).length,
          totalPromotions: (promotions || []).length,
          totalSpecialRequests: (specialRequests || []).length,
          totalGroups: (groups || []).length,
          totalSpecialConditions: (specialConditions || []).length,
          totalRoomFeatures: (roomFeatures || []).length,
          totalPricingRules: (pricingRules || []).length,
          totalTaxInfo: (taxInfo || []).length
        }
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

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM hotel_rates WHERE hotel_id = ?`;
      const [countResult]: any = await pool.query(countQuery, [hotelId]);
      const total = countResult[0].total;

      // Get paginated data
      const dataQuery = `
        SELECT 
          id, hotel_id, room_code, board_code, date_from, date_to,
          rate_type, base_price, tax_amount, adults, board_type, price
        FROM hotel_rates 
        WHERE hotel_id = ?
        ORDER BY date_from DESC, room_code ASC
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
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error: any) {
      Logger.error('[REPO] Error fetching hotel rates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get destinations with pagination
   */
  async getDestinations(page: number = 1, limit: number = 50): Promise<any> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM destinations`;
      const [countResult]: any = await pool.query(countQuery);
      const total = countResult[0].total;

      // Get paginated data
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
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
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
        'hotels', 'categories', 'chains', 'destinations',
        'hotel_contracts', 'hotel_rates', 'hotel_inventory',
        'hotel_room_allocations', 'hotel_supplements',
        'hotel_email_settings', 'hotel_configurations'
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
   * ⚡ LOCK-FREE APPROACH - Use READ UNCOMMITTED to bypass locks
   */
  async computeCheapestPrices(category: string = 'ALL', hotelId?: number): Promise<any> {
    const start = Date.now();

    Logger.info('⚡ START');
    await this.createCheapestPPTable();

    const cats = category === 'ALL' ? ['CITY_TRIP', 'OTHER'] : [category];

    try {
      // Clean old data first
      Logger.info('🗑️  Cleaning old prices...');
      if (hotelId) {
        await pool.query(`DELETE FROM cheapest_pp WHERE hotel_id = ${hotelId}`);
        Logger.info(`   ✅ Cleaned prices for hotel ${hotelId}`);
      } else {
        await pool.query('TRUNCATE TABLE cheapest_pp');
        Logger.info('   ✅ All old prices cleaned');
      }

      // BYPASS LOCKS + FK checks
      await pool.query('SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');

      Logger.info('Computing...');
      let total = 0;

      for (const cat of cats) {
        const n = cat === 'CITY_TRIP' ? 2 : 5;
        Logger.info(`${cat}...`);

        // Only select hotels that exist in hotels table (FK safe!)
        const [res]: any = await pool.query(`
          INSERT INTO cheapest_pp 
          (hotel_id, category_tag, start_date, nights, board_code, room_code, price_pp, total_price, currency, has_promotion)
          SELECT r.hotel_id, '${cat}', MIN(r.date_from), ${n}, 'RO', 'STD',
                 ROUND(MIN(r.price) * ${n} / 2, 2), ROUND(MIN(r.price) * ${n}, 2), 'EUR', 0
          FROM hotel_rates r
          INNER JOIN hotels h ON h.id = r.hotel_id
          WHERE r.price > 0
          ${hotelId ? `AND r.hotel_id = ${hotelId}` : ''}
          GROUP BY r.hotel_id
          ON DUPLICATE KEY UPDATE 
            price_pp = VALUES(price_pp), 
            total_price = VALUES(total_price), 
            derived_at = NOW()
        `);

        total += res.affectedRows || 0;
        Logger.info(`✅ ${cat}: ${res.affectedRows}`);
      }

      // Restore settings
      await pool.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');

      const dur = ((Date.now() - start) / 1000).toFixed(2);
      Logger.info(`✅ ${total} prices | ${dur}s`);

      return { success: true, computed: total, duration: `${dur}s` };
    } catch (error: any) {
      await pool.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ').catch(() => { });
      await pool.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => { });
      Logger.error('❌ Failed:', error);
      throw error;
    }
  }


  /**
   * Get available rooms for a hotel with dates and rates
   */
  async getAvailableRooms(hotelId: number, checkIn?: string, nights?: number, page: number = 1, limit: number = 10, maxDates: number = 10): Promise<any> {
    try {
      Logger.info('[REPO] Getting available rooms:', { hotelId, checkIn, nights, page, limit, maxDates });

      // Build date filter with SQL date functions
      let dateFilter = '';
      const params: any[] = [hotelId];

      if (checkIn && nights) {
        dateFilter = `AND r.date_from >= ? AND r.date_from < DATE_ADD(?, INTERVAL ? DAY)`;
        params.push(checkIn, checkIn, nights);
      }

      // First, get total count of unique rooms
      const countQuery = `
        SELECT COUNT(DISTINCT r.room_code) as total
        FROM hotel_rates r
        WHERE r.hotel_id = ? 
          AND r.price > 0
          ${dateFilter}
      `;
      const [countResult]: any = await pool.query(countQuery, params);
      const total = countResult[0].total;

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get paginated room_codes first (separate query to avoid MySQL LIMIT in subquery issue)
      const roomCodesQuery = `
        SELECT DISTINCT r.room_code 
        FROM hotel_rates r
        WHERE r.hotel_id = ? 
          AND r.price > 0
          ${dateFilter}
        ORDER BY r.room_code
        LIMIT ? OFFSET ?
      `;

      const [roomCodeResults]: any = await pool.query(roomCodesQuery, [...params, limit, offset]);

      if (roomCodeResults.length === 0) {
        Logger.info('[REPO] No rooms found for pagination', { page, limit });
        return {
          data: [],
          pagination: {
            page,
            limit,
            total,
            totalPages
          },
          settings: {
            maxDatesPerRoom: maxDates
          }
        };
      }

      const roomCodes = roomCodeResults.map((r: any) => r.room_code);

      // Now get all data for these room codes
      const query = `
        SELECT 
          r.room_code,
          r.board_code,
          DATE_FORMAT(r.date_from, '%Y-%m-%d') as date_from,
          r.date_to,
          r.price,
          r.adults,
          ra.min_adults,
          ra.max_adults,
          ra.min_children,
          ra.max_children
        FROM hotel_rates r
        LEFT JOIN hotel_room_allocations ra ON ra.hotel_id = r.hotel_id AND ra.room_code = r.room_code
        WHERE r.hotel_id = ? 
          AND r.price > 0
          ${dateFilter}
          AND r.room_code IN (${roomCodes.map(() => '?').join(',')})
        ORDER BY r.room_code, r.date_from, r.price
      `;

      const queryParams = [...params, ...roomCodes];
      const [rooms]: any = await pool.query(query, queryParams);

      Logger.info('[REPO] Rooms data fetched:', {
        totalRecords: rooms.length,
        totalUniqueRooms: total,
        page,
        sampleDates: rooms.slice(0, 3).map((r: any) => r.date_from)
      });

      // Group by room_code and date (to avoid duplicates)
      const roomsMap = new Map();

      for (const room of rooms) {
        if (!roomsMap.has(room.room_code)) {
          roomsMap.set(room.room_code, {
            roomCode: room.room_code,
            boardCode: room.board_code,
            minAdults: room.min_adults,
            maxAdults: room.max_adults,
            minChildren: room.min_children,
            maxChildren: room.max_children,
            datesMap: new Map(), // Use Map to group by date
            priceRange: { min: parseFloat(room.price), max: parseFloat(room.price) }
          });
        }

        const roomData = roomsMap.get(room.room_code);
        const price = parseFloat(room.price);
        const dateKey = room.date_from;

        // Group by date - keep the cheapest price for each date
        if (!roomData.datesMap.has(dateKey)) {
          roomData.datesMap.set(dateKey, {
            date: dateKey,
            price: price,
            adults: room.adults,
            boardCode: room.board_code,
            variants: 1 // Count how many variants exist
          });
        } else {
          // If date already exists, keep the cheaper price
          const existing = roomData.datesMap.get(dateKey);
          if (price < existing.price) {
            existing.price = price;
            existing.boardCode = room.board_code;
            existing.adults = room.adults;
          }
          existing.variants++; // Increment variant count
        }

        // Update price range
        if (price < roomData.priceRange.min) roomData.priceRange.min = price;
        if (price > roomData.priceRange.max) roomData.priceRange.max = price;
      }

      // Limit dates per room and add summary
      const roomsArray = Array.from(roomsMap.values()).map(room => {
        // Convert datesMap to sorted array
        const allDates = Array.from(room.datesMap.values()).sort((a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const totalDatesCount = allDates.length;
        const limitedDates = allDates.slice(0, maxDates);

        return {
          roomCode: room.roomCode,
          boardCode: room.boardCode,
          minAdults: room.minAdults,
          maxAdults: room.maxAdults,
          minChildren: room.minChildren,
          maxChildren: room.maxChildren,
          availableDates: limitedDates,
          totalAvailableDates: totalDatesCount, // Total unique dates
          showingDates: limitedDates.length,    // Showing count
          priceRange: room.priceRange
        };
      });

      Logger.info('[REPO] Available rooms result:', {
        roomsInPage: roomsArray.length,
        totalRooms: total,
        page,
        totalPages,
        maxDatesPerRoom: maxDates,
        rooms: roomsArray.map(r => ({
          room: r.roomCode,
          totalDates: r.totalAvailableDates,
          showing: r.showingDates
        }))
      });

      return {
        data: roomsArray,
        pagination: {
          page,
          limit,
          total,
          totalPages
        },
        settings: {
          maxDatesPerRoom: maxDates
        }
      };
    } catch (error: any) {
      Logger.error('[REPO] Error getting available rooms', { error: error.message });
      throw error;
    }
  }

  /**
   * Check availability - Get all available rooms for dates with pricing
   */
  async checkAvailability(hotelId: number, checkIn: string, nights: number, roomCodeFilter?: string): Promise<any> {
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkIn);
      checkOutDate.setDate(checkOutDate.getDate() + nights);
      const checkOut = checkOutDate.toISOString().split('T')[0];

      // Get all rates in date range (will filter by exact dates later)
      const roomFilter = roomCodeFilter ? `AND room_code = '${roomCodeFilter}'` : '';

      // Fetch rates using raw SQL date comparison
      const [rates]: any = await pool.query(`
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
      `, [hotelId, checkIn, checkIn, nights]);

      Logger.info('[REPO] Rates fetched:', {
        count: rates.length,
        sampleDates: rates.slice(0, 5).map((r: any) => ({
          room: r.room_code,
          date: r.date_from
        }))
      });

      if (!rates || rates.length === 0) {
        return {
          hotelId,
          checkIn,
          checkOut,
          nights,
          rooms: [],
          message: 'No rooms available for selected dates'
        };
      }

      // Build expected dates list
      const expectedDates: string[] = [];
      for (let i = 0; i < nights; i++) {
        const d = new Date(checkIn);
        d.setDate(d.getDate() + i);
        expectedDates.push(d.toISOString().split('T')[0]);
      }

      Logger.info('[REPO] Expected dates:', { dates: expectedDates });

      // Group by room_code and collect rates
      const roomsMap = new Map();

      for (const rate of rates) {
        const dateStr = rate.date_from; // Already formatted as YYYY-MM-DD from SQL

        if (!roomsMap.has(rate.room_code)) {
          roomsMap.set(rate.room_code, {
            roomCode: rate.room_code,
            boardCode: rate.board_code,
            rates: [],
            totalPrice: 0,
            datesFound: new Set()
          });
        }

        const roomData = roomsMap.get(rate.room_code);

        // Avoid duplicates
        if (!roomData.datesFound.has(dateStr)) {
          roomData.datesFound.add(dateStr);
          roomData.rates.push({
            date: dateStr,
            price: parseFloat(rate.price),
            board: rate.board_code,
            adults: rate.adults
          });
          roomData.totalPrice += parseFloat(rate.price);
        }
      }

      // Get unique dates found in rates
      const allDatesFound = new Set<string>();
      roomsMap.forEach(room => {
        room.datesFound.forEach((date: string) => allDatesFound.add(date));
      });

      Logger.info('[REPO] Rooms analysis:', {
        totalRooms: roomsMap.size,
        rooms: Array.from(roomsMap.keys()),
        uniqueDatesInRates: Array.from(allDatesFound).sort(),
        expectedDates: expectedDates
      });

      // Filter rooms that have ALL required nights
      const completeRooms = Array.from(roomsMap.values()).filter(room => {
        const hasAllNights = room.datesFound.size === nights;
        if (!hasAllNights) {
          Logger.info('[REPO] Room incomplete:', {
            roomCode: room.roomCode,
            datesFound: Array.from(room.datesFound).sort(),
            missingDates: expectedDates.filter(d => !room.datesFound.has(d)),
            required: nights
          });
        }
        return hasAllNights;
      });

      // Get room allocations for capacity info
      if (completeRooms.length === 0) {
        return {
          hotelId,
          checkIn,
          checkOut,
          nights,
          rooms: [],
          message: `No rooms available with complete ${nights} consecutive nights`
        };
      }

      const roomCodes = completeRooms.map(r => r.roomCode);
      const [allocations]: any = await pool.query(`
        SELECT room_code, min_adults, max_adults, min_children, max_children
        FROM hotel_room_allocations
        WHERE hotel_id = ?
          AND room_code IN (${roomCodes.map(r => `'${r}'`).join(',')})
        GROUP BY room_code
      `, [hotelId]);

      const allocMap = new Map(
        allocations.map((a: any) => [a.room_code, {
          minAdults: a.min_adults,
          maxAdults: a.max_adults,
          minChildren: a.min_children,
          maxChildren: a.max_children
        }])
      );

      // Build final response with only complete rooms
      const availableRooms = completeRooms.map(room => ({
        roomCode: room.roomCode,
        boardCode: room.boardCode,
        totalPrice: parseFloat(room.totalPrice.toFixed(2)),
        pricePerPerson: parseFloat((room.totalPrice / 2).toFixed(2)),
        currency: 'EUR',
        nightlyRates: room.rates.sort((a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        capacity: allocMap.get(room.roomCode) || null
      }));

      return {
        hotelId,
        checkIn,
        checkOut,
        nights,
        totalRooms: availableRooms.length,
        rooms: availableRooms
      };
    } catch (error: any) {
      Logger.error('[REPO] Error checking availability', { error: error.message });
      throw error;
    }
  }

  /**
   * Search hotels with cheapest prices (per document spec)
   */
  async searchHotels(filters: any, sort: string, page: number, limit: number): Promise<any> {
    try {
      // Build WHERE clause
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

      // Build ORDER BY
      const sortMap: any = {
        price_asc: 'cp.price_pp ASC',
        price_desc: 'cp.price_pp DESC',
        name_asc: 'h.name ASC',
        name_desc: 'h.name DESC'
      };
      const orderBy = sortMap[sort] || 'cp.price_pp ASC';

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM cheapest_pp cp
        INNER JOIN hotels h ON h.id = cp.hotel_id
        ${whereClause}
      `;
      const [countResult]: any = await pool.query(countQuery, params);
      const total = countResult[0].total;

      // Get paginated data
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
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error: any) {
      Logger.error('[REPO] Search error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create cheapest_pp table if not exists
   */
  private async createCheapestPPTable(): Promise<void> {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS cheapest_pp (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          hotel_id BIGINT NOT NULL,
          category_tag VARCHAR(20) DEFAULT 'CITY_TRIP',
          start_date DATE NOT NULL,
          nights INT NOT NULL,
          board_code VARCHAR(10),
          room_code VARCHAR(50),
          price_pp DECIMAL(10, 2) NOT NULL,
          total_price DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(5) DEFAULT 'EUR',
          has_promotion BOOLEAN DEFAULT FALSE,
          derived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_hotel_category (hotel_id, category_tag),
          INDEX idx_category_price (category_tag, price_pp),
          INDEX idx_start_date (start_date),
          UNIQUE KEY uk_hotel_category (hotel_id, category_tag)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;

      await pool.query(createTableQuery);
      Logger.info('[REPO] cheapest_pp table ensured');
    } catch (error: any) {
      Logger.error('[REPO] Failed to create cheapest_pp table', { error: error.message });
      throw error;
    }
  }

}

