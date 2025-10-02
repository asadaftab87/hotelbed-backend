import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import axios from "axios";
import pLimit from "p-limit";
import mysql from "mysql2/promise";
import { mapRow } from "../../../utils/mapper";
import { bulkInsertRaw } from "../../../utils/bulkInsertRaw";
import ProgressBar from "progress"; 3
import ora from "ora";
import { buildInventory } from "../../../utils/inventoryJob";
const BASE_URL = "https://aif2.hotelbeds.com/aif2-pub-ws/files";
const BATCH_SIZE = 2000;
const CONCURRENCY = 5;

const pool = mysql.createPool({
  host: "13.222.188.164",
  user: "asadaftab",
  password: "Asad124@",
  database: "hotelbed",
  waitForConnections: true,
  connectionLimit: 20,
});

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
  CNES: "ExtraStay",
  CNSU: "ExtraSupplement",
  CNGR: "Group",
  CNOE: "Offer",
  SIIN: "ServiceInfoIn",
  SIAP: "ServiceInfoAp",
  SICF: "ServiceInfoCf",
  SIA: "ServiceInfoA",
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
  private static async parseFileToJson(filePath: string) {
    const content = await fs.promises.readFile(filePath, "utf8");
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
        const parts = line.split(":");
        const row: Record<string, string> = {};
        parts.forEach((val, i) => (row[`field_${i}`] = val));
        sections[currentSection].push(row);
      }
    }
    return sections;
  }

  private static async processDir(dir: string, mode: "full" | "update") {
    const files = await fs.promises.readdir(dir, { withFileTypes: true });
    const limit = pLimit(CONCURRENCY);

    await Promise.all(
      files.map(file =>
        limit(async () => {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) return this.processDir(fullPath, mode);
          if (!file.isFile()) return;

          console.log(`📂 Processing ${file.name}`);

          try {
            // ✅ Insert into HotelBedFile (your schema supports this)
            const [result] = await pool.query(
              "INSERT INTO `HotelBedFile` (`name`) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
              [file.name]
            );
            const fileId = (result as any).insertId;

            const jsonData = await this.parseFileToJson(fullPath);

            for (const [section, rows] of Object.entries(jsonData)) {
              if (!rows.length) continue;
              const mappedRows = mapRow(section, rows).map(r => ({
                hotelBedId: fileId,
                ...r,
              }));

              for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
                const chunk = mappedRows.slice(i, i + BATCH_SIZE);
                const table = SECTION_TABLE_MAP[section];
                if (!table) continue;

                // 👇 for update feeds, enable overwrite (ON DUPLICATE)
                await bulkInsertRaw(table, chunk, pool, {
                  onDuplicate: mode === "update",
                });
              }
            }
            await buildInventory(fileId);
            console.log(`✅ Done ${file.name}`);
          } catch (err: any) {
            console.error(`❌ Failed ${file.name}:`, err.message);
          }
        })
      )
    );
  }
}

