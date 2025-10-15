/**
 * 🚀 HOTELBEDS TURBO REPOSITORY - COMPLETE RAW SQL IMPLEMENTATION
 * 
 * COMPLETE END-TO-END FLOW:
 * 1. Clean Database (if full mode)
 * 2. Download ZIP from Hotelbeds API
 * 3. Extract ZIP to filesystem
 * 4. Process CONTRACT files (all sections)
 * 5. Build Inventory table (complex logic)
 * 6. Process GENERAL files (HotelMaster, BoardMaster)
 * 7. Run Precompute Service
 * 8. Update SearchIndex
 * 9. Cleanup temporary files
 * 
 * PURE RAW SQL - NO PRISMA OVERHEAD
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import axios from "axios";
import mysql from "mysql2/promise";
import pLimit from "p-limit";
import Logger from "../../../core/Logger";
import { precomputeService } from "../../../services/precompute.service";
import { mapRow } from "../../../utils/mapper";

const BASE_URL = "https://aif2.hotelbeds.com/aif2-pub-ws/files";
const API_KEY = "f513d78a7046ca883c02bd80926aa1b7";
const BATCH_SIZE = 3000;
const CONCURRENCY = 10;

// MySQL Connection Pool (HIGH PERFORMANCE)
const pool = mysql.createPool({
  host: process.env.DB_HOST || "107.21.156.43",
  user: process.env.DB_USER || "asadaftab",
  password: process.env.DB_PASSWORD || "Asad124@",
  database: process.env.DB_NAME || "hotelbed",
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
  multipleStatements: true,
});

// Section to Table mapping (from documentation)
const SECTION_TABLE_MAP: Record<string, string> = {
  CCON: "Contract",
  CNPR: "Promotion",
  CNHA: "Room",
  CNIN: "Restriction",
  CNCT: "Cost",
  CNEM: "MinMaxStay",
  CNSR: "Supplement",
  CNPV: "StopSale",
  CNCF: "CancellationFee",
  CNTA: "RateCode",
};

export default class HotelBedTurboRepo {
  /**
   * ═══════════════════════════════════════════════════════════════
   * MAIN METHOD - Complete end-to-end flow
   * ═══════════════════════════════════════════════════════════════
   */
  static async executeFullFlow(mode: "full" | "update" = "full") {
    const overallStart = Date.now();
    Logger.info("═".repeat(60));
    Logger.info(`🚀 HOTELBEDS TURBO - ${mode.toUpperCase()} MODE`);
    Logger.info("═".repeat(60));

    try {
      // STEP 1: Clean Database (if full mode)
      if (mode === "full") {
        await this.step1_CleanDatabase();
      }

      // STEP 2: Download ZIP
      const { zipPath, extractPath, version } = await this.step2_DownloadZip(mode);

      // STEP 3: Extract ZIP
      await this.step3_ExtractZip(zipPath, extractPath);

      // STEP 4: Process CONTRACT files
      await this.step4_ProcessContractFiles(extractPath, mode);

      // STEP 5: Process GENERAL files (HotelMaster, BoardMaster)
      await this.step5_ProcessGeneralFiles(extractPath);

      // STEP 6: Cleanup files
      await this.step6_Cleanup(zipPath, extractPath);

      // STEP 7: Run Precompute
      const precomputeResult = await this.step7_RunPrecompute();

      // STEP 8: Update SearchIndex
      const searchIndexCount = await this.step8_UpdateSearchIndex();

      const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2);

      Logger.info("═".repeat(60));
      Logger.info("🎉 COMPLETE SUCCESS!");
      Logger.info("═".repeat(60));
      Logger.info(`✅ Mode: ${mode}`);
      Logger.info(`✅ Version: ${version}`);
      Logger.info(`✅ Hotels Processed: ${precomputeResult.processed}`);
      Logger.info(`✅ Prices Computed: ${precomputeResult.updated}`);
      Logger.info(`✅ SearchIndex Updated: ${searchIndexCount} hotels`);
      Logger.info(`⚡ Total Duration: ${totalDuration}s (${(parseFloat(totalDuration) / 60).toFixed(1)} min)`);
      Logger.info("═".repeat(60));
      Logger.info("");
      Logger.info("💡 Next Steps:");
      Logger.info("   1. Test Search API: GET /api/v1/search?destination=PMI");
      Logger.info("   2. View API Docs: http://localhost:5000/api-docs");
      Logger.info("");

      return {
        success: true,
        mode,
        version,
        totalDuration: parseFloat(totalDuration),
        precompute: {
          processed: precomputeResult.processed,
          updated: precomputeResult.updated,
          failed: precomputeResult.failed,
          duration: precomputeResult.duration,
        },
        searchIndex: searchIndexCount,
      };
    } catch (error: any) {
      Logger.error("❌ TURBO Flow Failed:", error);
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * MANUAL: Process GENERAL Folder Only
   * Use when HotelMaster is empty but CONTRACT data exists
   * ═══════════════════════════════════════════════════════════════
   */
  static async processGeneralFolder(extractPath: string) {
    Logger.info("🏨 Processing GENERAL folder manually...");
    
    try {
      await this.step5_ProcessGeneralFiles(extractPath);
      
      // Count results
      const [result] = await pool.execute<any[]>(
        "SELECT COUNT(*) as count FROM HotelMaster"
      );
      const hotelCount = result[0]?.count || 0;
      
      const [boardResult] = await pool.execute<any[]>(
        "SELECT COUNT(*) as count FROM BoardMaster"
      );
      const boardCount = boardResult[0]?.count || 0;
      
      Logger.info(`✅ GENERAL folder processed successfully!`);
      Logger.info(`   HotelMaster: ${hotelCount} hotels`);
      Logger.info(`   BoardMaster: ${boardCount} boards`);
      
      return {
        success: true,
        hotelMasterCount: hotelCount,
        boardMasterCount: boardCount,
      };
    } catch (error: any) {
      Logger.error("❌ Failed to process GENERAL folder:", error);
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STEP 1: Clean Database
   * ═══════════════════════════════════════════════════════════════
   */
  private static async step1_CleanDatabase() {
    Logger.info("\n🧹 STEP 1: Cleaning Database...");
    const conn = await pool.getConnection();

    try {
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");

      const tables = [
        "Contract", "Promotion", "Room", "Restriction", "Cost",
        "MinMaxStay", "Supplement", "StopSale", "CancellationFee", "RateCode",
        "Inventory", "HotelMaster", "BoardMaster", "CheapestPricePerPerson",
        "SearchIndex", "HotelBedFile"
      ];

      for (const table of tables) {
        Logger.info(`   🧹 Truncating ${table}...`);
        await conn.query(`TRUNCATE TABLE \`${table}\``);
      }

      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      Logger.info("✅ Database cleaned successfully\n");
    } finally {
      conn.release();
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STEP 2: Download ZIP
   * ═══════════════════════════════════════════════════════════════
   */
  private static async step2_DownloadZip(mode: string) {
    Logger.info("📥 STEP 2: Downloading ZIP from Hotelbeds...");

    const url = `${BASE_URL}/${mode}`;
    const headers = { "Api-Key": API_KEY };

    const response = await axios.get(url, {
      headers,
      responseType: "stream",
      timeout: 0,
    });

    const version = response.headers["x-version"] || Date.now().toString();
    const totalLength = parseInt(response.headers["content-length"] || "0", 10);

    const zipPath = path.join(__dirname, `../../../../downloads/hotelbeds_${mode}_${version}.zip`);
    const extractPath = path.join(__dirname, `../../../../downloads/hotelbeds_${mode}_${version}`);

    await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

    const writer = fs.createWriteStream(zipPath);
    let downloaded = 0;
    let lastLog = 0;

    response.data.on("data", (chunk: Buffer) => {
      downloaded += chunk.length;
      const now = Date.now();

      // Log every 2 seconds
      if (now - lastLog > 2000 || downloaded >= totalLength) {
        const percent = totalLength ? ((downloaded / totalLength) * 100).toFixed(1) : "?";
        const mb = this.formatBytes(downloaded);
        process.stdout.write(`\r   📥 Downloaded: ${mb} (${percent}%)  `);
        lastLog = now;
      }
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on("finish", () => resolve(undefined));
      writer.on("error", reject);
    });

    console.log(); // New line
    Logger.info(`✅ Downloaded: ${this.formatBytes(downloaded)}\n`);

    return { zipPath, extractPath, version };
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STEP 3: Extract ZIP
   * ═══════════════════════════════════════════════════════════════
   */
  private static async step3_ExtractZip(zipPath: string, extractPath: string) {
    Logger.info("📂 STEP 3: Extracting ZIP...");

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    Logger.info(`✅ Extracted to: ${extractPath}\n`);
  }

  /**
   * Utility: Find folder recursively
   */
  private static findFolder(baseDir: string, folderName: string, maxDepth: number = 3): string | null {
    const search = (currentDir: string, depth: number): string | null => {
      if (depth > maxDepth) return null;
      
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(currentDir, entry.name);
            
            if (entry.name === folderName) {
              return fullPath;
            }
            
            const found = search(fullPath, depth + 1);
            if (found) return found;
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
      
      return null;
    };
    
    return search(baseDir, 0);
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STEP 4: Process CONTRACT Files
   * ═══════════════════════════════════════════════════════════════
   */
  private static async step4_ProcessContractFiles(extractPath: string, mode: string) {
    Logger.info("⚡ STEP 4: Processing CONTRACT files (RAW SQL)...");

    // Dynamically find CONTRACT folder
    const contractDir = this.findFolder(extractPath, "CONTRACT");

    if (!contractDir) {
      Logger.info("⚠️  No CONTRACT directory found!");
      Logger.info("⚠️  Skipping pricing/inventory data.");
      Logger.info("⚠️  Only master data (hotels/boards) will be loaded.\n");
      Logger.info("💡 To get complete data with pricing:");
      Logger.info("   Download full feed from: https://aif2.hotelbeds.com/aif2-pub-ws/files/full");
      Logger.info("   Or run: node download-full-zip.js\n");
      return;
    }

    Logger.info(`   📁 Found CONTRACT at: ${contractDir}`);

    const files = fs.readdirSync(contractDir).filter(f => f.startsWith("C"));
    Logger.info(`   📁 Found ${files.length} CONTRACT files\n`);

    const limit = pLimit(CONCURRENCY);
    let processedFiles = 0;

    await Promise.all(
      files.map(fileName =>
        limit(async () => {
          const filePath = path.join(contractDir, fileName);

          try {
            Logger.info(`\n   📄 Processing file: ${fileName}`);

            // Parse file into sections
            const sections = await this.parseFile(filePath);
            Logger.info(`   📊 Found ${Object.keys(sections).length} sections in ${fileName}`);

            // Log section sizes
            for (const [sectionName, rows] of Object.entries(sections)) {
              if (rows.length > 0) {
                Logger.info(`      • ${sectionName}: ${rows.length} rows`);
              }
            }

            // Create HotelBedFile entry
            const fileId = await this.createFileEntry(fileName);
            Logger.info(`   ✅ Created HotelBedFile entry: ${fileId}`);

            // Process all sections with RAW SQL
            for (const [sectionName, rows] of Object.entries(sections)) {
              const tableName = SECTION_TABLE_MAP[sectionName];
              if (!tableName) {
                if (rows.length > 0) {
                  Logger.info(`   ⚠️  ${sectionName}: No table mapping (${rows.length} rows skipped)`);
                }
                continue;
              }
              if (rows.length === 0) continue;

              await this.bulkInsertSection(sectionName, tableName, rows, fileId, mode);
            }

            // Build Inventory table (complex logic from CNIN, CNPV, CNEM)
            Logger.info(`   🏗️  Building Inventory table for ${fileName}...`);
            await this.buildInventoryTable(sections, fileId);

            processedFiles++;
            Logger.info(`   ✅ Completed ${fileName} (${processedFiles}/${files.length})\n`);
          } catch (error: any) {
            Logger.error(`   ❌ Failed ${fileName}: ${error.message}`);
            Logger.error(`   Stack: ${error.stack}`);
          }
        })
      )
    );

    Logger.info(`✅ CONTRACT files processed: ${processedFiles}/${files.length}\n`);
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STEP 5: Process GENERAL Files (HotelMaster, BoardMaster)
   * ═══════════════════════════════════════════════════════════════
   */
  private static async step5_ProcessGeneralFiles(extractPath: string) {
    Logger.info("📊 STEP 5: Processing GENERAL files (HotelMaster, BoardMaster)...");

    // Dynamically find GENERAL folder
    const generalDir = this.findFolder(extractPath, "GENERAL");

    if (!generalDir) {
      Logger.info("⚠️  No GENERAL directory found\n");
      return;
    }

    Logger.info(`   📁 Found GENERAL at: ${generalDir}`);

    // Get or create file entry
    const fileId = await this.getOrCreateFileId("GENERAL_IMPORT");

    // Load GHOT_F (HotelMaster)
    await this.loadHotelMaster(generalDir, fileId);

    // Load GTTO_F (BoardMaster)
    await this.loadBoardMaster(generalDir, fileId);

    Logger.info("✅ GENERAL files processed\n");
  }

  /**
   * Load HotelMaster from GHOT_F
   */
  private static async loadHotelMaster(generalDir: string, fileId: string) {
    const ghotPath = path.join(generalDir, "GHOT_F");

    if (!fs.existsSync(ghotPath)) {
      Logger.info("   ⚠️  GHOT_F not found");
      return;
    }

    // Clear existing data
    await pool.execute("DELETE FROM HotelMaster WHERE hotelBedId = ?", [fileId]);

    const content = fs.readFileSync(ghotPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("{"));

    Logger.info(`   📊 Loading ${lines.length.toLocaleString()} hotels...`);

    const BATCH_SIZE = 4000; // Max safe for 15 fields
    let inserted = 0;
    let batch: any[] = [];

    for (const line of lines) {
      const fields = line.split(":");

      if (fields.length >= 12) {
        // Hotel name can contain colons, so join everything from position 11 onwards
        const hotelName = fields.slice(11).join(":").trim();
        
        batch.push([
          randomUUID(),
          fileId,
          fields[0] || null,  // hotelCode
          fields[1] || null,  // hotelCategory
          fields[2] || null,  // destinationCode
          fields[3] || null,  // chainCode
          fields[4] || null,  // contractMarket
          fields[5] || null,  // ranking
          fields[6] === "1" ? 1 : 0,  // noHotelFlag
          fields[7] || null,  // countryCode
          fields[8] || null,  // accommodationType
          null,               // accommodationCode (not in GHOT_F format)
          fields[9] || null,  // latitude
          fields[10] || null, // longitude
          hotelName || null,  // hotelName (joined from position 11+)
        ]);

        if (batch.length >= BATCH_SIZE) {
          try {
            await this.bulkInsertHotelMaster(batch);
            inserted += batch.length;
            process.stdout.write(`\r   ⚡ Inserted: ${inserted.toLocaleString()} hotels  `);
          } catch (error: any) {
            Logger.error(`   ❌ Batch insert failed: ${error.message}`);
            Logger.error(`   SQL: ${error.sql?.substring(0, 200)}`);
          }
          batch = [];
        }
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      try {
        await this.bulkInsertHotelMaster(batch);
        inserted += batch.length;
      } catch (error: any) {
        Logger.error(`   ❌ Final batch insert failed: ${error.message}`);
        Logger.error(`   Error code: ${error.code}`);
        Logger.error(`   SQL State: ${error.sqlState}`);
      }
    }

    console.log(); // New line
    Logger.info(`   ✅ HotelMaster: ${inserted.toLocaleString()} hotels loaded`);
  }

  /**
   * Bulk insert HotelMaster
   */
  private static async bulkInsertHotelMaster(batch: any[]) {
    const placeholders = batch.map(() =>
      "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
    ).join(",");

    const values = batch.flat();

    await pool.execute(`
      INSERT INTO HotelMaster 
      (id, hotelBedId, hotelCode, hotelCategory, destinationCode, chainCode,
       contractMarket, ranking, noHotelFlag, countryCode, accommodationType,
       accommodationCode, latitude, longitude, hotelName, createdAt)
      VALUES ${placeholders}
    `, values);
  }

  /**
   * Load BoardMaster from GTTO_F
   */
  private static async loadBoardMaster(generalDir: string, fileId: string) {
    const gttoPath = path.join(generalDir, "GTTO_F");

    if (!fs.existsSync(gttoPath)) {
      Logger.info("   ⚠️  GTTO_F not found");
      return;
    }

    // Clear existing data
    await pool.execute("DELETE FROM BoardMaster WHERE hotelBedId = ?", [fileId]);

    const content = fs.readFileSync(gttoPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("{"));

    Logger.info(`   📊 Loading ${lines.length.toLocaleString()} boards...`);

    const BATCH_SIZE = 10000; // Max safe for 5 fields
    let inserted = 0;
    let batch: any[] = [];

    for (const line of lines) {
      const fields = line.split(":");

      if (fields.length >= 3) {
        batch.push([
          randomUUID(),
          fileId,
          fields[0] || null,  // boardCode
          fields[1] || null,  // boardType
          fields[2] || null,  // boardName
        ]);

        if (batch.length >= BATCH_SIZE) {
          try {
            await this.bulkInsertBoardMaster(batch);
            inserted += batch.length;
          } catch (error: any) {
            Logger.error(`   ❌ BoardMaster batch failed: ${error.message}`);
          }
          batch = [];
        }
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      try {
        await this.bulkInsertBoardMaster(batch);
        inserted += batch.length;
      } catch (error: any) {
        Logger.error(`   ❌ BoardMaster final batch failed: ${error.message}`);
      }
    }

    Logger.info(`   ✅ BoardMaster: ${inserted.toLocaleString()} boards loaded`);
  }

  /**
   * Bulk insert BoardMaster
   */
  private static async bulkInsertBoardMaster(batch: any[]) {
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, NOW())").join(",");
    await pool.execute(`
      INSERT INTO BoardMaster 
      (id, hotelBedId, boardCode, boardType, boardName, createdAt)
      VALUES ${placeholders}
    `, batch.flat());
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * BUILD INVENTORY TABLE (Complex Logic)
   * ═══════════════════════════════════════════════════════════════
   */
  private static async buildInventoryTable(
    sections: Record<string, any[]>,
    fileId: string
  ) {
    const cninData = sections.CNIN || [];
    const cnpvData = sections.CNPV || []; // Stop sales
    const cnemData = sections.CNEM || []; // Min/Max nights
    const cconData = sections.CCON || []; // Contract

    if (cninData.length === 0) return;

    // Get hotel code from contract
    const hotelCode = cconData[0]?.hotelCode || null;

    // Build lookup maps for performance
    const stopSaleMap = new Map<string, boolean>();
    cnpvData.forEach((pv: any) => {
      const key = `${pv.roomCode}|${pv.characteristic}|${pv.rateCode}`;
      stopSaleMap.set(key, pv.stopSalesFlag === true);
    });

    const minMaxMap = new Map<string, { minNights?: number; maxNights?: number }>();
    cnemData.forEach((em: any) => {
      const key = `${em.roomCode}|${em.characteristic}|${em.boardCode}`;
      const [min, max] = (em.daysRules || "").split("-").map(Number);
      minMaxMap.set(key, {
        minNights: !isNaN(min) ? min : null,
        maxNights: !isNaN(max) ? max : null,
      });
    });

    // Build inventory rows
    const inventoryRows: any[] = [];

    cninData.forEach((cnin: any) => {
      const lookupKey = `${cnin.roomCode}|${cnin.characteristic}|${cnin.rateCode || ""}`;
      const stopSale = stopSaleMap.get(lookupKey) || false;
      const minMax = minMaxMap.get(`${cnin.roomCode}|${cnin.characteristic}|`) || {};

      // Parse inventoryTuples: "(releaseDays,allotment)(releaseDays,allotment)..."
      const tuples = cnin.inventoryTuples || "";
      const dailyInventory = tuples.match(/\((\d+),(\d+)\)/g) || [];

      // If no tuples, create single record
      if (dailyInventory.length === 0) {
        const startDate = this.parseDate(cnin.startDate);
        if (!startDate) return;

        inventoryRows.push([
          randomUUID(),
          fileId,
          this.toMySQLDate(startDate),
          hotelCode,
          cnin.roomCode,
          cnin.characteristic,
          cnin.rateCode || null,
          cnin.allotment || null,
          stopSale,
          cnin.releaseDays || null,
          cnin.releaseDays || null,
          0,
          minMax.minNights || null,
          minMax.maxNights || null,
        ]);
        return;
      }

      // Create one inventory record per day from tuples
      const startDate = this.parseDate(cnin.startDate);
      if (!startDate) return;

      dailyInventory.forEach((tuple: string, dayIndex: number) => {
        const match = tuple.match(/\((\d+),(\d+)\)/);
        if (!match) return;

        const releaseDays = parseInt(match[1], 10);
        const allotment = parseInt(match[2], 10);

        // Calculate calendar date
        const calendarDate = new Date(startDate);
        calendarDate.setDate(calendarDate.getDate() + dayIndex);

        inventoryRows.push([
          randomUUID(),
          fileId,
          this.toMySQLDate(calendarDate),
          hotelCode,
          cnin.roomCode,
          cnin.characteristic,
          cnin.rateCode || null,
          allotment,
          stopSale || allotment === 0,
          releaseDays,
          releaseDays, // cta
          0, // ctd
          minMax.minNights || null,
          minMax.maxNights || null,
        ]);
      });
    });

    // Bulk insert inventory
    if (inventoryRows.length > 0) {
      const BATCH_SIZE = 5000;
      for (let i = 0; i < inventoryRows.length; i += BATCH_SIZE) {
        const batch = inventoryRows.slice(i, i + BATCH_SIZE);
        await this.bulkInsertInventory(batch);
      }
    }
  }

  /**
   * Bulk insert Inventory
   */
  private static async bulkInsertInventory(batch: any[]) {
    const placeholders = batch.map(() =>
      "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
    ).join(",");

    await pool.execute(`
      INSERT INTO Inventory
      (id, hotelBedId, calendarDate, hotelCode, roomCode, characteristic,
       ratePlanId, allotment, stopSale, releaseDays, cta, ctd, minNights, maxNights, createdAt)
      VALUES ${placeholders}
    `, batch.flat());
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * BULK INSERT SECTION (Generic)
   * ═══════════════════════════════════════════════════════════════
   */
  private static async bulkInsertSection(
    sectionName: string,
    tableName: string,
    rawRows: any[],
    fileId: string,
    mode: string
  ) {
    if (rawRows.length === 0) {
      Logger.info(`   ⚠️  ${sectionName} → ${tableName}: 0 rows (skipped)`);
      return;
    }

    Logger.info(`   📝 ${sectionName} → ${tableName}: ${rawRows.length} raw rows`);

    // Map rows using utility
    const mappedRows = mapRow(sectionName, rawRows);
    if (mappedRows.length === 0) {
      Logger.error(`   ❌ ${sectionName}: Mapping returned 0 rows!`);
      return;
    }

    Logger.info(`   ✅ ${sectionName}: Mapped ${mappedRows.length} rows`);

    // Get field names
    const fields = Object.keys(mappedRows[0]);
    const columns = ["id", "hotelBedId", ...fields, "createdAt"].join(", ");

    Logger.info(`   📊 ${tableName} fields: ${fields.length} fields`);

    const BATCH_SIZE = 3000;
    let inserted = 0;

    for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
      const batch = mappedRows.slice(i, i + BATCH_SIZE);

      const placeholders = batch.map(() =>
        `(?, ?, ${fields.map(() => "?").join(", ")}, NOW())`
      ).join(",");

      const values = batch.flatMap(row => [
        randomUUID(),
        fileId,
        ...fields.map(f => row[f]),
      ]);

      try {
        if (mode === "update") {
          // ON DUPLICATE KEY UPDATE for update mode
          const updateClause = fields.map(f => `\`${f}\` = VALUES(\`${f}\`)`).join(", ");
          await pool.execute(`
            INSERT INTO \`${tableName}\` (${columns})
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE ${updateClause}
          `, values);
        } else {
          // Simple INSERT for full mode
          await pool.execute(`
            INSERT INTO \`${tableName}\` (${columns})
            VALUES ${placeholders}
          `, values);
        }

        inserted += batch.length;
        Logger.info(`   ⚡ ${tableName}: Inserted ${inserted}/${mappedRows.length}`);
      } catch (error: any) {
        Logger.error(`   ❌ ${tableName} insert failed: ${error.message}`);
        Logger.error(`   SQL Error: ${error.sql || 'N/A'}`);
        Logger.error(`   Fields: ${fields.join(', ')}`);
        // Don't throw - continue with next batch
      }
    }

    Logger.info(`   ✅ ${tableName}: Total inserted ${inserted} rows\n`);
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STEP 6: Cleanup
   * ═══════════════════════════════════════════════════════════════
   */
  private static async step6_Cleanup(zipPath: string, extractPath: string) {
    Logger.info("🗑️  STEP 6: Cleaning up temporary files...");

    try {
      await fs.promises.unlink(zipPath);
      await fs.promises.rm(extractPath, { recursive: true, force: true });
      Logger.info("✅ Cleanup complete\n");
    } catch (error: any) {
      Logger.error(`⚠️  Cleanup failed: ${error.message}\n`);
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STEP 7: Run Precompute
   * ═══════════════════════════════════════════════════════════════
   */
  private static async step7_RunPrecompute() {
    Logger.info("🔢 STEP 7: Running Precompute Service (RAW SQL)...");

    const result = await precomputeService.runFullPrecompute();

    Logger.info(`✅ Precompute: ${result.processed} hotels, ${result.updated} prices, ${result.duration}s\n`);

    return result;
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * STEP 8: Update SearchIndex
   * ═══════════════════════════════════════════════════════════════
   */
  private static async step8_UpdateSearchIndex() {
    Logger.info("📊 STEP 8: Updating SearchIndex (RAW SQL)...");

    const count = await precomputeService.updateSearchIndex();

    Logger.info(`✅ SearchIndex: ${count} hotels indexed\n`);

    return count;
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * UTILITY METHODS
   * ═══════════════════════════════════════════════════════════════
   */

  /**
   * Parse file into sections
   */
  private static async parseFile(filePath: string): Promise<Record<string, any[]>> {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const sections: Record<string, any[]> = {};
    let currentSection: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith("{") && !line.startsWith("{/")) {
        currentSection = line.replace(/[{}]/g, "");
        sections[currentSection] = [];
      } else if (line.startsWith("{/")) {
        currentSection = null;
      } else if (currentSection) {
        // ⚡ SPECIAL HANDLING for CNCT (Cost) section - Parse tuples!
        if (currentSection === "CNCT") {
          const parsedRows = this.parseCNCTLine(line);
          sections[currentSection].push(...parsedRows);
        } else {
          const parts = line.split(":");
          const row: Record<string, string> = {};
          parts.forEach((val, i) => (row[`field_${i}`] = val));
          sections[currentSection].push(row);
        }
      }
    }

    return sections;
  }

  /**
   * Parse CNCT line with tuples into individual Cost records
   * Format: startDate:endDate:roomCode:characteristic:rateCode:releaseDays:allotment:(tuples)
   * Tuple: (genericRate,netPrice,publicPrice,specificRate,boardCode,amount)
   * Example: 20250910:20261008:DBL:C2-NI:::(N,0.000,0.000,0,RO,171.610)(N,0.000,0.000,0,RO,203.230)...
   */
  private static parseCNCTLine(line: string): any[] {
    const parts = line.split(":");
    
    // Extract base fields (0-3) - fields 4-6 are empty in ZIP
    const startDate = parts[0] || "";
    const endDate = parts[1] || "";
    const roomCode = parts[2] || "";
    const characteristic = parts[3] || "";
    // Note: parts[4] (rateCode), parts[5] (releaseDays), parts[6] (allotment) are empty in ZIP
    
    // Extract tuples (everything after field 6)
    const tuplesStr = parts.slice(7).join(":"); // Re-join in case there are colons inside
    
    // Parse tuples: (N,0.000,0.000,0,RO,171.610)(N,0.000,0.000,0,RO,203.230)...
    const tupleRegex = /\(([^)]+)\)/g;
    const matches = [...tuplesStr.matchAll(tupleRegex)];
    
    const rows: any[] = [];
    
    for (const match of matches) {
      const tupleData = match[1].split(",");
      
      // Tuple fields: genericRate, netPrice, publicPrice, specificRate, boardCode, amount
      const genericRate = tupleData[0] || "";
      const netPrice = tupleData[1] || "";
      const publicPrice = tupleData[2] || "";
      const specificRate = tupleData[3] || "";
      const boardCode = tupleData[4] || "";
      const amount = tupleData[5] || "";
      
      // Create row with all fields mapped
      rows.push({
        field_0: startDate,
        field_1: endDate,
        field_2: roomCode,
        field_3: characteristic,
        field_4: genericRate,
        field_5: "",  // marketPriceCode (not in tuple)
        field_6: "",  // perPaxFlag (not in tuple)
        field_7: netPrice,
        field_8: publicPrice,
        field_9: specificRate,
        field_10: boardCode,
        field_11: amount,
        field_12: "",  // validFrom (not in tuple)
        field_13: ""   // validTo (not in tuple)
      });
    }
    
    return rows;
  }

  /**
   * Create file entry
   */
  private static async createFileEntry(fileName: string): Promise<string> {
    const fileId = randomUUID();
    await pool.execute(
      "INSERT INTO HotelBedFile (id, name, createdAt) VALUES (?, ?, NOW())",
      [fileId, fileName]
    );
    return fileId;
  }

  /**
   * Get or create file ID
   */
  private static async getOrCreateFileId(fileName: string): Promise<string> {
    const [existing] = await pool.execute<any[]>(
      "SELECT id FROM HotelBedFile WHERE name = ?",
      [fileName]
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    const fileId = randomUUID();
    await pool.execute(
      "INSERT INTO HotelBedFile (id, name, createdAt) VALUES (?, ?, NOW())",
      [fileId, fileName]
    );

    return fileId;
  }

  /**
   * Parse date from YYYYMMDD format
   */
  private static parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.length < 8) return null;

    try {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    } catch {
      return null;
    }
  }

  /**
   * Convert Date to MySQL datetime format
   */
  private static toMySQLDate(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  /**
   * Format bytes to human readable
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

