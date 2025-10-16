import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import axios from "axios";
import pLimit from "p-limit";
import mysql from "mysql2/promise";
import { mapRow } from "../../../utils/mapper";
import { bulkInsertRaw } from "../../../utils/bulkInsertRaw";
import ProgressBar from "progress"; 3
import ora from "ora";
const BASE_URL = "https://aif2.hotelbeds.com/aif2-pub-ws/files";
const BATCH_SIZE = 2000;
const CONCURRENCY = 5;


// 🎯 BALANCED POOL: Optimized to avoid lock timeouts
const pool = mysql.createPool({
  host: "107.21.156.43",
  user: "asadaftab",
  password: "Asad124@",
  database: "hotelbed",
  waitForConnections: true,
  connectionLimit: 40, // 🎯 Balanced - enough for 5 parallel inserts
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: true,
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
  connectTimeout: 60000,
  charset: 'utf8mb4_unicode_ci',
});


const SECTION_TABLE_MAP: Record<string, string> = {
  HOTEL: "HotelMaster",
  BOARD: "BoardMaster",
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
  CNES: "ExtraStay",
  CNSU: "ExtraSupplement",
  CNGR: "Group",
  CNOE: "Offer",
  CNNH: "Client",
  CNCL: "ValidMarket",
  CNHF: "HandlingFee",
  ATAX: "Tax",
};

// Helper function to convert bytes → MB/GB string
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default class HotelBedFileRepo {
  static async createFromZip(mode: "full" | "update" = "full") {
    const url = `${BASE_URL}/${mode}`;
    const headers = { "Api-Key": "f513d78a7046ca883c02bd80926aa1b7" };
    if (mode === "full") {
      console.log("🧹 Cleaning Database before full feed...");
      await this.cleanDatabase();
    }
    const response = await axios.get(url, {
      headers,
      responseType: "stream",
      timeout: 0,
    });

    const version = response.headers["x-version"];
    if (!version) throw new Error("No X-Version found in response.");

    const totalLength = parseInt(response.headers["content-length"] || "0", 10);

    const zipPath = path.join(
      __dirname,
      `../../../../downloads/hotelbeds_${mode}_${version}.zip`
    );
    const extractPath = path.join(
      __dirname,
      `../../../../downloads/hotelbeds_${mode}_${version}`
    );

    // const extractPath = path.join(
    //   __dirname,
    //   `../../../../downloads/hotelbeds_full_1760032801`
    // );
    await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

    const writer = fs.createWriteStream(zipPath);

    let downloaded = 0;
    let bar: ProgressBar | null = null;
    let spinner: any = null;

    if (totalLength > 0) {
      // ✅ Normal Progress Bar
      bar = new ProgressBar(
        "📥 Downloading [:bar] :percent :etas (:downloaded / :total)",
        {
          width: 40,
          complete: "=",
          incomplete: " ",
          total: totalLength,
        }
      );
    } else {
      // ⚡ Fallback Spinner (no content-length)
      spinner = ora("📥 Downloading... 0 MB").start();
    }

    response.data.on("data", (chunk: Buffer) => {
      downloaded += chunk.length;
      if (bar) {
        bar.tick(chunk.length, {
          downloaded: formatBytes(downloaded),
          total: formatBytes(totalLength),
        });
      } else if (spinner) {
        spinner.text = `📥 Downloaded ${formatBytes(downloaded)} (size unknown)`;
      }
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      // @ts-ignore
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    if (spinner) spinner.succeed(`✅ Download complete: ${formatBytes(downloaded)}`);

    console.log(`\n✅ File saved: ${zipPath}`);

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    console.log(`📂 Extracted to: ${extractPath}`);

    await this.processDir(extractPath, mode);
    // ✅ Process complete hone ke baad cleanup
    try {
      await fs.promises.unlink(zipPath); // delete zip file
      await fs.promises.rm(extractPath, { recursive: true, force: true }); // delete extracted folder
      console.log("🗑️ Cleaned up downloaded files & extracted folder.");
    } catch (err: any) {
      console.error("⚠️ Cleanup failed:", err.message);
    }
    return { result: `${mode} Feed Applied In DB` };
  }
  private static async cleanDatabase() {
    try {
      const conn = await pool.getConnection();
      try {
        await conn.query("SET FOREIGN_KEY_CHECKS = 0");

        // Truncate all mapped tables
        for (const table of Object.values(SECTION_TABLE_MAP)) {
          console.log(`🧹 Truncating ${table}...`);
          await conn.query(`TRUNCATE TABLE \`${table}\``);
        }

        // Truncate Inventory table
        console.log(`🧹 Truncating Inventory...`);
        await conn.query("TRUNCATE TABLE `Inventory`");

        // Truncate HotelBedFile table also
        await conn.query("TRUNCATE TABLE `HotelBedFile`");

        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
        console.log("✅ Database cleaned successfully.");
      } finally {
        conn.release();
      }
    } catch (err: any) {
      console.error("❌ Failed to clean DB:", err.message);
      throw err;
    }
  }
  // 🚀 OPTIMIZATION 4: Optimized parsing with minimal operations
  private static async parseFileToJson(filePath: string) {
    const content = await fs.promises.readFile(filePath, "utf8");
    const lines = content.split("\n");

    const sections: Record<string, any[]> = {};
    let currentSection: string | null = null;
    let currentArray: any[] | null = null; // Cache current section array

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;

      const line = rawLine.trim();
      if (!line) continue;

      const firstChar = line[0];
      
      // Fast check for section markers
      if (firstChar === "{") {
        if (line[1] === "/") {
        currentSection = null;
          currentArray = null;
        } else {
          currentSection = line.slice(1, -1); // Faster than replace
          currentArray = [];
          sections[currentSection] = currentArray;
        }
      } else if (currentSection && currentArray) {
        // ⚡ SPECIAL HANDLING for CNCT (Cost) section - Parse tuples!
        if (currentSection === "CNCT") {
          const parsedRows = this.parseCNCTLine(line);
          if (parsedRows.length > 0) {
            currentArray.push(...parsedRows);
          }
        } else {
        const parts = line.split(":");
        const row: Record<string, string> = {};
          for (let j = 0; j < parts.length; j++) {
            row[`field_${j}`] = parts[j];
          }
          currentArray.push(row);
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
    // 🛡️ ROBUST APPROACH: Find first parenthesis instead of relying on fixed index
    // This makes it resilient to format changes
    const firstParenIndex = line.indexOf("(");
    
    if (firstParenIndex === -1) {
      console.log(`⚠️  CNCT line has no tuples (no opening parenthesis): ${line.substring(0, 100)}...`);
      return [];
    }
    
    // Extract base fields from the part BEFORE first parenthesis
    const baseFields = line.substring(0, firstParenIndex);
    const parts = baseFields.split(":");
    
    // Extract base fields (0-3)
    const startDate = parts[0] || "";
    const endDate = parts[1] || "";
    const roomCode = parts[2] || "";
    const characteristic = parts[3] || "";
    // parts[4], parts[5] are typically empty (rateCode, releaseDays)
    
    // Extract tuples string (everything from first parenthesis onwards)
    const tuplesStr = line.substring(firstParenIndex);
    
    // Parse tuples: (N,0.000,0.000,0,RO,171.610)(N,0.000,0.000,0,RO,203.230)...
    const tupleRegex = /\(([^)]+)\)/g;
    const matches = [...tuplesStr.matchAll(tupleRegex)];
    
    if (matches.length === 0) {
      console.log(`⚠️  No tuples matched in CNCT line. TuplesStr: ${tuplesStr.substring(0, 100)}`);
      return [];
    }
    
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

  private static async buildInventoryTable(
    sections: Record<string, any[]>,
    fileId: string,
    pool: mysql.Pool
  ) {
    const cninData = sections.CNIN || [];
    const cnpvData = sections.CNPV || []; // Stop sales
    const cnemData = sections.CNEM || []; // Min/Max nights
    const cconData = sections.CCON || []; // Contract for hotel code

    if (!cninData.length) return;

    // Get hotel code from contract
    const hotelCode = cconData[0]?.hotelCode || null;

    // Build lookup maps for performance
    const stopSaleMap = new Map<string, boolean>();
    cnpvData.forEach(pv => {
      const key = `${pv.roomCode}|${pv.characteristic}|${pv.rateCode}`;
      stopSaleMap.set(key, pv.stopSalesFlag === true);
    });

    const minMaxMap = new Map<string, { minNights?: number; maxNights?: number }>();
    cnemData.forEach(em => {
      const key = `${em.roomCode}|${em.characteristic}|${em.boardCode}`;
      // Parse daysRules like "3-5" -> min=3, max=5
      const [min, max] = (em.daysRules || "").split("-").map(Number);
      minMaxMap.set(key, {
        minNights: !isNaN(min) ? min : null,
        maxNights: !isNaN(max) ? max : null
      });
    });

    // Build inventory rows with parsed daily inventory data
    const inventoryRows: any[] = [];

    cninData.forEach(cnin => {
      const lookupKey = `${cnin.roomCode}|${cnin.characteristic}|${cnin.rateCode || ''}`;
      const stopSale = stopSaleMap.get(lookupKey) || null;
      const minMax = minMaxMap.get(`${cnin.roomCode}|${cnin.characteristic}|`) || {};

      // Parse inventoryTuples: "(0,10)(0,10)(0,10)..." -> daily (releaseDays, allotment)
      const tuples = cnin.inventoryTuples || "";
      const dailyInventory = tuples.match(/\((\d+),(\d+)\)/g) || [];

      // If no tuples, create one record with null values
      if (dailyInventory.length === 0) {
        inventoryRows.push({
          id: randomUUID(),
          hotelBedId: fileId,
          calendarDate: cnin.startDate,
          hotelCode: hotelCode,
          roomCode: cnin.roomCode,
          characteristic: cnin.characteristic,
          ratePlanId: cnin.rateCode || null,
          allotment: cnin.allotment || null,
          stopSale: stopSale,
          releaseDays: cnin.releaseDays || null,
          cta: cnin.releaseDays || null,
          ctd: 0,
          minNights: minMax.minNights || null,
          maxNights: minMax.maxNights || null,
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
        return;
      }

      // Create one inventory record per day from tuples
      dailyInventory.forEach((tuple: string, dayIndex: number) => {
        const match = tuple.match(/\((\d+),(\d+)\)/);
        if (!match) return;

        const releaseDays = parseInt(match[1], 10);
        const allotment = parseInt(match[2], 10);

        // Calculate actual calendar date (startDate + dayIndex)
        const calendarDate = new Date(cnin.startDate);
        calendarDate.setDate(calendarDate.getDate() + dayIndex);

        // Calculate CTA/CTD
        const cta = releaseDays;
        const ctd = 0;

        inventoryRows.push({
          id: randomUUID(),
          hotelBedId: fileId,
          calendarDate: calendarDate.toISOString().slice(0, 19).replace('T', ' '),
          hotelCode: hotelCode,
          roomCode: cnin.roomCode,
          characteristic: cnin.characteristic,
          ratePlanId: cnin.rateCode || null,
          allotment: allotment,
          stopSale: stopSale || allotment === 0,
          releaseDays: releaseDays,
          cta: cta,
          ctd: ctd,
          minNights: minMax.minNights || null,
          maxNights: minMax.maxNights || null,
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
      });
    });

    // Bulk insert into Inventory table
    for (let i = 0; i < inventoryRows.length; i += BATCH_SIZE) {
      const chunk = inventoryRows.slice(i, i + BATCH_SIZE);
      await bulkInsertRaw("Inventory", chunk, pool, { onDuplicate: true });
    }
  }

  private static async processDir(dir: string, mode: "full" | "update") {
    const spinner = ora('🚀 Collecting all files...').start();
    
    // 🏨 SPECIAL HANDLING: Process GENERAL folder first (HotelMaster & BoardMaster)
    const generalPath = path.join(dir, "GENERAL");
    if (fs.existsSync(generalPath)) {
      spinner.succeed('✅ Found GENERAL folder');
      spinner.start('🏨 Processing GENERAL folder (HotelMaster & BoardMaster)...');
      await this.processGeneralFolderInternal(generalPath);
      spinner.succeed('✅ GENERAL folder processed');
    }
    
    // 🚀 STEP 1: Collect ALL CONTRACT file paths (skip GENERAL)
    spinner.start('🚀 Collecting CONTRACT files...');
    const allFiles = await this.getAllFilePaths(dir, ['GENERAL']);
    spinner.succeed(`✅ Found ${allFiles.length} CONTRACT files to process`);

    // 🎯 OPTIMIZED STREAMING: Balance between speed and stability
    // ⚡ Fast flow without lock timeouts
    const MICRO_BATCH = 800; // 🎯 Balanced batch size
    const PARSE_CONCURRENCY = 120; // 🎯 Controlled parsing
    const totalFiles = allFiles.length;
    let totalProcessed = 0;
    const globalInsertResults: Record<string, number> = {};
    
    // ⚡ ULTRA-FAST MySQL performance tuning (SUPER privilege enabled!)
    await pool.query('SET foreign_key_checks = 0');
    await pool.query('SET unique_checks = 0');
    await pool.query('SET autocommit = 0');
    await pool.query('SET sql_log_bin = 0'); // 🚀 Disable binary logging - 20-30% faster!
    // Note: innodb_flush_log_at_trx_commit is GLOBAL only (too risky to change server-wide)
    
    console.log(`\n🎯 OPTIMIZED STREAMING: Fast + Stable (No lock timeouts!)`);
    console.log(`⚡ Batches of ${MICRO_BATCH} files | 5 parallel inserts | 40 DB connections`);
    spinner.start(`⚡ STREAMING ${totalFiles} files...`);
    const processStart = Date.now();
    
    for (let streamIdx = 0; streamIdx < totalFiles; streamIdx += MICRO_BATCH) {
      const batchNum = Math.floor(streamIdx/MICRO_BATCH) + 1;
      const totalBatches = Math.ceil(totalFiles/MICRO_BATCH);
      const batchStart = Date.now();
      const streamBatch = allFiles.slice(streamIdx, streamIdx + MICRO_BATCH);
      
      // ⚡ Parse instantly (no progress tracking for speed)
      const limit = pLimit(PARSE_CONCURRENCY);
      
      const parsedData = await Promise.all(
        streamBatch.map((filePath) => limit(async () => {
          try {
            const sections = await this.parseFileToJson(filePath);
            return {
              fileId: randomUUID(),
              fileName: path.basename(filePath),
              sections
            };
          } catch (error: any) {
            return null;
          }
        }))
      );
      
      const validParsedData = parsedData.filter(Boolean) as any[];
      
      // ⚡ Instant aggregation - no delays!
      const batchAggregated: Record<string, any[]> = {};
      const fileRecords: any[] = [];
      const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      for (let i = 0; i < validParsedData.length; i++) {
        const { fileId, fileName, sections } = validParsedData[i];
        fileRecords.push({ id: fileId, name: fileName, createdAt });
        
        for (const section in sections) {
          const rows = sections[section];
          if (!rows || rows.length === 0) continue;
          if (!batchAggregated[section]) batchAggregated[section] = [];
          
          const mapped = mapRow(section, rows);
          for (let j = 0; j < mapped.length; j++) {
            mapped[j].hotelBedId = fileId;
            batchAggregated[section].push(mapped[j]);
          }
        }
      }
      
      // Insert file records for this batch
      if (fileRecords.length > 0) {
        await bulkInsertRaw("HotelBedFile", fileRecords, pool, { onDuplicate: true });
      }
      
      // ⚡ CONTROLLED INSERTION: Balanced for no locks
      const INSERT_BATCH = 6000; // 🎯 Balanced batch size
      const insertLimit = pLimit(5); // 🎯 5 tables parallel - no lock timeout!
      
      await Promise.all(
        Object.entries(batchAggregated).map(([section, rows]) =>
          insertLimit(async () => {
            const tableName = SECTION_TABLE_MAP[section];
            if (!tableName || rows.length === 0) return;
            
            try {
              for (let i = 0; i < rows.length; i += INSERT_BATCH) {
                await bulkInsertRaw(tableName, rows.slice(i, i + INSERT_BATCH), pool, { onDuplicate: mode === "update" });
              }
              globalInsertResults[tableName] = (globalInsertResults[tableName] || 0) + rows.length;
            } catch (error: any) {
              console.error(`❌ ${tableName}: ${error.message}`);
            }
          })
        )
      );
      
      totalProcessed += validParsedData.length;
      await pool.query('COMMIT');
      await pool.query('START TRANSACTION');
      
      // Quick progress update every 10 batches
      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        const elapsed = ((Date.now() - processStart) / 1000 / 60).toFixed(1);
        const avgTimePerBatch = (Date.now() - processStart) / batchNum;
        const etaMin = Math.round((avgTimePerBatch * (totalBatches - batchNum)) / 60000);
        console.log(`⚡ Batch ${batchNum}/${totalBatches} | ${totalProcessed}/${totalFiles} (${Math.round(totalProcessed/totalFiles*100)}%) | ${elapsed}min elapsed | ETA: ${etaMin}min`);
      }
      
      if (global.gc) global.gc();
    }
    
    const processTime = ((Date.now() - processStart) / 1000).toFixed(1);
    spinner.succeed(`✅ Processed ${totalProcessed} files in ${processTime}s`);
    
    // Re-enable checks and commit
    spinner.start('💾 Committing transaction...');
    await pool.query('COMMIT');
    await pool.query('SET foreign_key_checks = 1');
    await pool.query('SET unique_checks = 1');
    await pool.query('SET autocommit = 1');
    await pool.query('SET sql_log_bin = 1'); // 🔄 Re-enable binary logging
    spinner.succeed(`✅ All data committed!`);

    // 🏗️ Build Inventory table from Restriction + other tables
    spinner.start('🏗️ Building Inventory table...');
    console.log('\n🏗️ Building Inventory table from Restriction, StopSale, MinMaxStay, and Contract data...');
    try {
      await this.buildInventoryFromDatabase();
      spinner.succeed('✅ Inventory table built successfully!');
    } catch (error: any) {
      console.error('❌ Error building Inventory:', error.message);
      spinner.fail('❌ Inventory build failed');
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   Files processed: ${totalProcessed}`);
    Object.entries(globalInsertResults).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} records`);
    });
    
    // 🔍 Specific check for Cost table
    const costCount = globalInsertResults['Cost'] || 0;
    if (costCount === 0) {
      console.log('\n⚠️  WARNING: No Cost records were inserted! This could mean:');
      console.log('   1. CNCT sections are empty in the downloaded files');
      console.log('   2. CNCT tuple parsing failed');
      console.log('   3. Cost data insertion failed');
      console.log('   Check the logs above for CNCT-related messages.');
    } else {
      console.log(`\n✅ Cost table populated successfully with ${costCount} records!`);
    }
  }

  /**
   * 🚀 Get all file paths recursively (iterative approach to avoid stack overflow)
   */
  private static async getAllFilePaths(dir: string, excludeDirs: string[] = []): Promise<string[]> {
    const paths: string[] = [];
    const queue: string[] = [dir]; // Use queue for iterative traversal

    while (queue.length > 0) {
      const currentDir = queue.shift()!;
      
      try {
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip excluded directories
            if (excludeDirs.includes(entry.name)) {
              continue;
            }
            queue.push(fullPath); // Add to queue instead of recursive call
          } else if (entry.isFile()) {
            paths.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Error reading directory ${currentDir}:`, error);
        continue;
      }
    }

    return paths;
  }

  /**
   * 🏨 Process GENERAL folder (HotelMaster & BoardMaster)
   */
  private static async processGeneralFolderInternal(generalDir: string) {
    const fileId = randomUUID();
    
    // Create file record
    await pool.query(
      "INSERT INTO `HotelBedFile` (`id`, `name`, `createdAt`) VALUES (?, ?, NOW())",
      [fileId, "GENERAL_IMPORT"]
    );

    // Load GHOT_F (HotelMaster)
    await this.loadHotelMaster(generalDir, fileId);

    // Load GTTO_F (BoardMaster)
    await this.loadBoardMaster(generalDir, fileId);
  }

  /**
   * Load HotelMaster from GHOT_F
   */
  private static async loadHotelMaster(generalDir: string, fileId: string) {
    const ghotPath = path.join(generalDir, "GHOT_F");

    if (!fs.existsSync(ghotPath)) {
      console.log("   ⚠️  GHOT_F not found");
      return;
    }

    // Clear existing data
    await pool.execute("DELETE FROM HotelMaster WHERE hotelBedId = ?", [fileId]);

    const content = fs.readFileSync(ghotPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("{"));

    console.log(`   📊 Loading ${lines.length.toLocaleString()} hotels...`);

    const BATCH_SIZE = 4000;
    let inserted = 0;
    let batch: any[] = [];

    for (const line of lines) {
      const fields = line.split(":");

      if (fields.length >= 12) {
        const hotelName = fields.slice(11).join(":").trim();
        
        batch.push([
          randomUUID(),
          fileId,
          fields[0] || null,
          fields[1] || null,
          fields[2] || null,
          fields[3] || null,
          fields[4] || null,
          fields[5] || null,
          fields[6] === "1" ? 1 : 0,
          fields[7] || null,
          fields[8] || null,
          null,
          fields[9] || null,
          fields[10] || null,
          hotelName || null,
        ]);

        if (batch.length >= BATCH_SIZE) {
          await this.bulkInsertHotelMaster(batch);
          inserted += batch.length;
          process.stdout.write(`\r   ⚡ Inserted: ${inserted.toLocaleString()} hotels  `);
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await this.bulkInsertHotelMaster(batch);
      inserted += batch.length;
    }

    console.log();
    console.log(`   ✅ HotelMaster: ${inserted.toLocaleString()} hotels loaded`);
  }

  /**
   * Load BoardMaster from GTTO_F
   */
  private static async loadBoardMaster(generalDir: string, fileId: string) {
    const gttoPath = path.join(generalDir, "GTTO_F");

    if (!fs.existsSync(gttoPath)) {
      console.log("   ⚠️  GTTO_F not found");
      return;
    }

    await pool.execute("DELETE FROM BoardMaster WHERE hotelBedId = ?", [fileId]);

    const content = fs.readFileSync(gttoPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("{"));

    console.log(`   📊 Loading ${lines.length.toLocaleString()} boards...`);

    const BATCH_SIZE = 10000;
    let inserted = 0;
    let batch: any[] = [];

    for (const line of lines) {
      const fields = line.split(":");

      if (fields.length >= 3) {
        batch.push([
          randomUUID(),
          fileId,
          fields[0] || null,
          fields[1] || null,
          fields[2] || null,
        ]);

        if (batch.length >= BATCH_SIZE) {
          await this.bulkInsertBoardMaster(batch);
          inserted += batch.length;
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await this.bulkInsertBoardMaster(batch);
      inserted += batch.length;
    }

    console.log(`   ✅ BoardMaster: ${inserted.toLocaleString()} boards loaded`);
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
   * Bulk insert BoardMaster
   */
  private static async bulkInsertBoardMaster(batch: any[]) {
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, NOW())").join(",");
    const values = batch.flat();

    await pool.execute(`
      INSERT INTO BoardMaster
      (id, hotelBedId, boardCode, boardType, boardName, createdAt)
      VALUES ${placeholders}
    `, values);
  }

  /**
   * 🚀 Build Inventory table from aggregated data (ULTRA-FAST)
   */
  private static async buildInventoryTableUltra(
    allParsedData: Array<{ fileId: string; fileName: string; sections: Record<string, any[]> }>
  ) {
    const inventoryRows: any[] = [];

    for (const { fileId, sections } of allParsedData) {
      const cninData = sections.CNIN || [];
      const cnpvData = sections.CNPV || [];
      const cnemData = sections.CNEM || [];
      const cconData = sections.CCON || [];

      if (!cninData.length) continue;

      const contractRow = cconData[0];
      const hotelCode = contractRow?.field_6 || null;

      const stopSaleMap = new Map<string, boolean>();
      cnpvData.forEach(pv => {
        const key = `${pv.field_2 || ""}|${pv.field_3 || ""}|${pv.field_4 || ""}`;
        stopSaleMap.set(key, pv.field_5 === "T");
      });

      const minMaxMap = new Map<string, { minNights?: number; maxNights?: number }>();
      cnemData.forEach(em => {
        const key = `${em.field_5 || ""}|${em.field_6 || ""}|${em.field_7 || ""}`;
        const minNights = em.field_8 ? parseInt(em.field_8) : undefined;
        const maxNights = em.field_9 ? parseInt(em.field_9) : undefined;
        minMaxMap.set(key, { minNights, maxNights });
      });

      cninData.forEach(cnin => {
        const roomCode = cnin.field_2 || "";
        const characteristic = cnin.field_3 || "";
        const rateCode = cnin.field_4 || "";
        const lookupKey = `${roomCode}|${characteristic}|${rateCode}`;
        const stopSale = stopSaleMap.get(lookupKey) || null;
        const minMax = minMaxMap.get(`${roomCode}|${characteristic}|`) || {};

        inventoryRows.push({
          id: randomUUID(),
          hotelBedId: fileId,
          calendarDate: cnin.field_5 || "",
          hotelCode: hotelCode,
          roomCode: roomCode,
          characteristic: characteristic,
          ratePlanId: rateCode || null,
          allotment: cnin.field_8 || null,
          stopSale: stopSale,
          releaseDays: cnin.field_7 || null,
          cta: cnin.field_7 || null,
          ctd: 0,
          minNights: minMax.minNights || null,
          maxNights: minMax.maxNights || null,
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
      });
    }

    const INV_BATCH = 5000;
    for (let i = 0; i < inventoryRows.length; i += INV_BATCH) {
      const chunk = inventoryRows.slice(i, i + INV_BATCH);
      await bulkInsertRaw("Inventory", chunk, pool, { onDuplicate: true });
    }
  }

  /**
   * 🏗️ Build Inventory table from database tables (Restriction, StopSale, MinMaxStay, Contract)
   * Uses data already in database instead of in-memory aggregation
   */
  private static async buildInventoryFromDatabase() {
    console.log('📊 Fetching data from Restriction, StopSale, MinMaxStay, and Contract tables...');
    
    // Fetch all required data
    const [restrictions, stopSales, minMaxStays, contracts] = await Promise.all([
      pool.query('SELECT * FROM Restriction'),
      pool.query('SELECT * FROM StopSale'),  
      pool.query('SELECT * FROM MinMaxStay'),
      pool.query('SELECT hotelBedId, hotelCode FROM Contract')
    ]);

    const restrictionData = (restrictions[0] as any[]);
    const stopSaleData = (stopSales[0] as any[]);
    const minMaxData = (minMaxStays[0] as any[]);
    const contractData = (contracts[0] as any[]);

    console.log(`   Restriction records: ${restrictionData.length}`);
    console.log(`   StopSale records: ${stopSaleData.length}`);
    console.log(`   MinMaxStay records: ${minMaxData.length}`);
    console.log(`   Contract records: ${contractData.length}`);

    // Build lookup maps
    const hotelCodeMap = new Map<string, string>();
    contractData.forEach((c: any) => {
      hotelCodeMap.set(c.hotelBedId, c.hotelCode);
    });

    const stopSaleMap = new Map<string, boolean>();
    stopSaleData.forEach((ss: any) => {
      const key = `${ss.hotelBedId}|${ss.roomCode}|${ss.characteristic}`;
      stopSaleMap.set(key, ss.stopSalesFlag === 1 || ss.stopSalesFlag === true);
    });

    const minMaxMap = new Map<string, { minNights?: number; maxNights?: number }>();
    minMaxData.forEach((mm: any) => {
      const key = `${mm.hotelBedId}|${mm.roomCode}|${mm.characteristic}`;
      minMaxMap.set(key, {
        minNights: mm.minNights,
        maxNights: mm.maxNights
      });
    });

    // Build inventory rows
    console.log('🔨 Building inventory rows...');
    const inventoryRows: any[] = [];

    for (const restriction of restrictionData) {
      const hotelCode = hotelCodeMap.get(restriction.hotelBedId) || null;
      const lookupKey = `${restriction.hotelBedId}|${restriction.roomCode}|${restriction.characteristic}`;
      const stopSale = stopSaleMap.get(lookupKey) || false;
      const minMax = minMaxMap.get(lookupKey) || {};

      // Parse inventory tuples if present
      const tuples = restriction.inventoryTuples || "";
      const tupleRegex = /\((\d+),(\d+)\)/g;
      const matches = [...tuples.matchAll(tupleRegex)];

      if (matches.length > 0) {
        // Create inventory record for each tuple (daily breakdown)
        let currentDate = restriction.startDate ? new Date(restriction.startDate) : null;
        
        matches.forEach((match) => {
          const releaseDays = parseInt(match[1]) || null;
          const allotment = parseInt(match[2]) || null;

          if (currentDate) {
            inventoryRows.push({
              // id: randomUUID(),  // 🚀 Removed! DB will auto-generate
              hotelBedId: restriction.hotelBedId,
              calendarDate: currentDate.toISOString().slice(0, 19).replace('T', ' '),
              hotelCode: hotelCode,
              roomCode: restriction.roomCode,
              characteristic: restriction.characteristic,
              ratePlanId: restriction.rateCode || null,
              allotment: allotment,
              stopSale: stopSale,
              releaseDays: releaseDays,
              cta: releaseDays,
              ctd: 0,
              minNights: minMax.minNights || null,
              maxNights: minMax.maxNights || null,
              createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
            });

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });
      } else {
        // No tuples - create single record
        inventoryRows.push({
          // id: randomUUID(),  // 🚀 Removed! DB will auto-generate
          hotelBedId: restriction.hotelBedId,
          calendarDate: restriction.startDate ? new Date(restriction.startDate).toISOString().slice(0, 19).replace('T', ' ') : null,
          hotelCode: hotelCode,
          roomCode: restriction.roomCode,
          characteristic: restriction.characteristic,
          ratePlanId: restriction.rateCode || null,
          allotment: restriction.allotment || null,
          stopSale: stopSale,
          releaseDays: restriction.releaseDays || null,
          cta: restriction.releaseDays || null,
          ctd: 0,
          minNights: minMax.minNights || null,
          maxNights: minMax.maxNights || null,
          createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
                });
              }
            }

    console.log(`   📦 Total inventory rows to insert: ${inventoryRows.length}`);

    // Bulk insert inventory
    const INV_BATCH = 5000;
    for (let i = 0; i < inventoryRows.length; i += INV_BATCH) {
      const chunk = inventoryRows.slice(i, i + INV_BATCH);
      await bulkInsertRaw("Inventory", chunk, pool, { onDuplicate: true });
      console.log(`   ⚡ Inserted ${Math.min(i + INV_BATCH, inventoryRows.length)}/${inventoryRows.length} inventory records`);
    }

    console.log(`✅ Inventory table built with ${inventoryRows.length} records!`);
  }
}
