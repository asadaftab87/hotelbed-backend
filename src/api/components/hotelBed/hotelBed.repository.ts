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

  /**
   * Clean ALL database tables before fresh import
   * Deletes all existing data to ensure clean import
   */
  private async cleanDatabase(): Promise<void> {
    try {
      Logger.info('[CLEAN] Starting complete database cleanup');

      // Disable foreign key checks temporarily
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');

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

      let cleaned = 0;
      for (const table of tables) {
        try {
          await pool.query(`TRUNCATE TABLE ${table}`);
          cleaned++;
          Logger.info('[CLEAN] Table cleaned', { table });
        } catch (error: any) {
          // Table might not exist, continue
          Logger.warn('[CLEAN] Failed to clean table', { 
            table, 
            error: error.message 
          });
        }
      }

      // Re-enable foreign key checks
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');

      Logger.info('[CLEAN] Database cleanup completed', { 
        tablesCleaned: cleaned,
        totalTables: tables.length
      });
    } catch (error: any) {
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

    if (!fs.existsSync(destinationsDir)) {
      Logger.warn('[IMPORT] Destinations directory not found', { path: destinationsDir });
      return { files: 0, failed: 0, duration: '0s' };
    }

    try {
      // Get all destination folders
      const destFolders = fs.readdirSync(destinationsDir).filter(f => {
        return fs.lstatSync(path.join(destinationsDir, f)).isDirectory();
      });

      Logger.info('[IMPORT] Starting hotel detail files import', {
        totalDestinations: destFolders.length,
        note: 'This will process 150k+ files - will take significant time'
      });

      let processedDestinations = 0;
      
      // ⚡ PERFORMANCE OPTIMIZATION: Disable FK checks for MASSIVE speed boost
      Logger.info('[IMPORT] Disabling foreign key checks for speed');
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      await pool.query('SET AUTOCOMMIT = 0'); // Batch transactions

      // 🔥🔥🔥 ULTRA SPEED MODE: 300 files + parallel destinations!
      const FILE_PARALLEL_BATCH = 300; // 3X FASTER!
      const DEST_PARALLEL_BATCH = 5; // Process 5 destinations at once!

      // Process destinations in parallel batches
      for (let d = 0; d < destFolders.length; d += DEST_PARALLEL_BATCH) {
        const destBatch = destFolders.slice(d, d + DEST_PARALLEL_BATCH);
        
        // Process multiple destinations simultaneously
        await Promise.all(
          destBatch.map(async (destFolder) => {
            const destPath = path.join(destinationsDir, destFolder);
            const hotelFiles = fs.readdirSync(destPath).filter(f => {
              return fs.lstatSync(path.join(destPath, f)).isFile();
            });

            // Process all files in this destination in parallel batches
            for (let i = 0; i < hotelFiles.length; i += FILE_PARALLEL_BATCH) {
              const fileBatch = hotelFiles.slice(i, i + FILE_PARALLEL_BATCH);
              
              // Use Promise.all for maximum speed (no error handling overhead)
              await Promise.all(
                fileBatch.map(async (hotelFile) => {
                  const filePath = path.join(destPath, hotelFile);
                  const hotelId = this.extractHotelIdFromFilename(hotelFile);
                  
                  if (!hotelId) return;
                  
                  try {
                    await this.processHotelDetailFile(filePath, hotelId);
                  } catch (e) {
                    // Silent fail for speed
                  }
                })
              );
            }
          })
        );

        processedDestinations += destBatch.length;

        // Ultra minimal logging: Only every 100 destinations
        if (processedDestinations % 100 === 0) {
          Logger.info(`[IMPORT] ${processedDestinations}/${destFolders.length}`);
        }
      }

      // ⚡ Re-enable FK checks
      await pool.query('COMMIT');
      await pool.query('SET AUTOCOMMIT = 1');
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      Logger.info('[IMPORT] Hotel details import completed!', {
        totalDestinations: destFolders.length,
        totalDuration: `${duration}s`
      });

      return {
        files: processedDestinations,
        duration: `${duration}s`,
        note: 'Stats tracking disabled for maximum speed'
      };
    } catch (error: any) {
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
    } catch (error) {
      return stats;
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
    const match = filename.match(/(\d+)_/);
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
        const parts = line.split(':');
        if (parts.length >= 4) {
          values.push([
            hotelId,
            parts[0] || null,  // promotion_code
            parts[1] || null,  // date_from
            parts[2] || null,  // date_to
            parts[3] || null,  // promotion_type
            line  // full_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_promotions
          (hotel_id, promotion_code, date_from, date_to, promotion_type, full_data)
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
        const parts = line.split(':');
        if (parts.length >= 3) {
          values.push([
            hotelId,
            parts[0] || null,  // request_code
            parts[1] || null,  // request_type
            parts[2] || null,  // description
            line  // full_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_special_requests
          (hotel_id, request_code, request_type, description, full_data)
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
        const parts = line.split(':');
        if (parts.length >= 2) {
          values.push([
            hotelId,
            parts[0] || null,  // group_code
            parts[1] || null,  // group_name
            line  // full_data
          ]);
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT IGNORE INTO hotel_groups
          (hotel_id, group_code, group_name, full_data)
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
   * Get hotel with ESSENTIAL details (optimized for performance)
   */
  async getHotelFullDetails(hotelId: number): Promise<any> {
    try {
      // 1. Get hotel basic info
      const hotelQuery = `
        SELECT 
          id, category, destination_code, chain_code, accommodation_type, 
          ranking, group_hotel, country_code, state_code, 
          longitude, latitude, name
        FROM hotels 
        WHERE id = ?
      `;
      const [hotelRows]: any = await pool.query(hotelQuery, [hotelId]);
      
      if (hotelRows.length === 0) {
        return null;
      }

      const hotel = hotelRows[0];

      // ⚡ OPTIMIZED: Parallel queries for speed + Limited data
      const [
        [rooms],
        [rates],
        [inventory],
        [contracts],
        [cancellationPolicies],
        [supplements],
        [rateTags]
      ] = await Promise.all([
        // Essential: Room allocations (limited to 10 most common)
        pool.query(`
          SELECT room_code, board_code, min_adults, max_adults, min_children, max_children, min_pax, max_pax
          FROM hotel_room_allocations 
          WHERE hotel_id = ? 
          ORDER BY room_code
          LIMIT 10
        `, [hotelId]),
        
        // Essential: Latest rates (limited to 20 most recent)
        pool.query(`
          SELECT room_code, board_code, date_from, date_to, rate_type, base_price, tax_amount, adults, price
          FROM hotel_rates 
          WHERE hotel_id = ? 
          ORDER BY date_from DESC
          LIMIT 20
        `, [hotelId]),
        
        // Essential: Recent inventory (limited to 10)
        pool.query(`
          SELECT room_code, board_code, date_from, date_to, availability_data
          FROM hotel_inventory 
          WHERE hotel_id = ? 
          ORDER BY date_from DESC
          LIMIT 10
        `, [hotelId]),
        
        // Essential: Active contracts (limited to 5 most recent)
        pool.query(`
          SELECT destination_code, contract_code, rate_code, board_code, contract_type, date_from, date_to, currency
          FROM hotel_contracts 
          WHERE hotel_id = ? 
          ORDER BY date_from DESC
          LIMIT 5
        `, [hotelId]),
        
        // Essential: Cancellation policies (limited to 5)
        pool.query(`
          SELECT policy_code, date_from, date_to, penalty_type, penalty_amount, cancellation_hours
          FROM hotel_cancellation_policies 
          WHERE hotel_id = ? 
          ORDER BY date_from DESC
          LIMIT 5
        `, [hotelId]),
        
        // Essential: Supplements/offers (limited to 5)
        pool.query(`
          SELECT date_from, date_to, supplement_code, supplement_type, discount_percent, min_nights
          FROM hotel_supplements 
          WHERE hotel_id = ?
          ORDER BY date_from DESC
          LIMIT 5
        `, [hotelId]),
        
        // Essential: Rate tags (usually small)
        pool.query(`
          SELECT tag_id, tag_name
          FROM hotel_rate_tags 
          WHERE hotel_id = ?
          LIMIT 10
        `, [hotelId])
      ]);

      // Combine essential data only
      const roomsData: any = rooms || [];
      const ratesData: any = rates || [];
      const inventoryData: any = inventory || [];
      const contractsData: any = contracts || [];
      const cancellationData: any = cancellationPolicies || [];
      const supplementsData: any = supplements || [];
      const tagsData: any = rateTags || [];

      return {
        ...hotel,
        details: {
          rooms: roomsData,
          rates: ratesData,
          inventory: inventoryData,
          contracts: contractsData,
          cancellationPolicies: cancellationData,
          supplements: supplementsData,
          rateTags: tagsData
        },
        summary: {
          totalRooms: roomsData.length,
          totalRates: ratesData.length,
          totalInventory: inventoryData.length,
          totalContracts: contractsData.length,
          hasSupplements: supplementsData.length > 0,
          hasCancellationPolicies: cancellationData.length > 0
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
}
