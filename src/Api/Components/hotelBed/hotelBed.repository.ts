import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import axios from "axios";
import readline from "readline";
import pLimit from "p-limit";
import mysql from "mysql2/promise";
import { prisma } from "../../../database";
import { mapRow } from "../../../utils/mapper";
import { bulkInsertRaw } from "../../../utils/bulkInsertRaw";

const HOTELBEDS_URL = "https://aif2.hotelbeds.com/aif2-pub-ws/files/full";
const BATCH_SIZE = 2000;
const CONCURRENCY = 5;

const pool = mysql.createPool({
  host: "98.80.71.117",
  user: "asadaftab",
  password: "Asad124@",   // raw password
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
  SIA: "ServiceInfoA"
};
export default class HotelBedFileRepo {
  static async createFromZip() {
    // const headers = { "Api-Key": "f513d78a7046ca883c02bd80926aa1b7" };

    // const response = await axios.get(HOTELBEDS_URL, {
    //   headers,
    //   responseType: "stream",
    // });

    // const version = response.headers["x-version"];
    // if (!version) throw new Error("No X-Version found in response.");

    // const zipPath = path.join(__dirname, "../../../../downloads/hotelbeds.zip");
    const extractPath = path.join(__dirname, "../../../../downloads/hotelbeds");

    // await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

    // const writer = fs.createWriteStream(zipPath);
    // await new Promise((resolve, reject) => {
    //   response.data.pipe(writer);
    //   writer.on("finish", resolve);
    //   writer.on("error", reject);
    // });

    // console.log(`[HotelBeds] Zip downloaded: ${zipPath}`);

    // const zip = new AdmZip(zipPath);
    // zip.extractAllTo(extractPath, true);
    // console.log(`📂 Extracted to: ${extractPath}`);

    await this.processDir(extractPath);

    return { result: "Data Feed In DB With Relations" };
  }

  /** SUPERFAST PARSER */
  private static async parseFileToJson(filePath: string) {
    const content = await fs.promises.readFile(filePath, "utf8"); // ⚡ full read
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



  /** PROCESS DIRECTORY WITH CONCURRENCY */
  // private static async processDir(dir: string) {
  //   const files = await fs.promises.readdir(dir, { withFileTypes: true });
  //   const limit = pLimit(CONCURRENCY);

  //   await Promise.all(
  //     files.map(file =>
  //       limit(async () => {
  //         const fullPath = path.join(dir, file.name);
  //         if (file.isDirectory()) return this.processDir(fullPath);
  //         if (!file.isFile()) return;

  //         console.log(`📂 Processing ${file.name}`);

  //         try {
  //           const jsonData = await this.parseFileToJson(fullPath);

  //           for (const [section, rows] of Object.entries(jsonData)) {
  //             if (!rows.length) continue;
  //             const mappedRows = mapRow(section, rows).map(r => ({ fileName: file.name, ...r }));

  //             for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
  //               const chunk = mappedRows.slice(i, i + BATCH_SIZE);
  //               const table = SECTION_TABLE_MAP[section];
  //               if (!table) continue;

  //               // direct raw insert with mysql2
  //               await bulkInsertRaw(table, chunk, pool, { onDuplicate: false });
  //             }
  //           }

  //           console.log(`✅ Done ${file.name}`);
  //         } catch (err: any) {
  //           console.error(`❌ Failed ${file.name}:`, err.message);
  //         }
  //       })
  //     )
  //   );
  // }
  private static async processDir(dir: string) {
    const files = await fs.promises.readdir(dir, { withFileTypes: true });
    const limit = pLimit(CONCURRENCY);

    await Promise.all(
      files.map(file =>
        limit(async () => {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) return this.processDir(fullPath);
          if (!file.isFile()) return;

          console.log(`📂 Processing ${file.name}`);

          try {
            // 1. Create HotelBedFile entry
            const [result] = await pool.query(
              "INSERT INTO `HotelBedFile` (`name`) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
              [file.name]
            );
            const fileId = (result as any).insertId;

            // 2. Parse file
            const jsonData = await this.parseFileToJson(fullPath);

            for (const [section, rows] of Object.entries(jsonData)) {
              if (!rows.length) continue;
              const mappedRows = mapRow(section, rows).map(r => ({
                hotelBedId: fileId, // 🔗 add foreign key
                ...r,
              }));

              for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
                const chunk = mappedRows.slice(i, i + BATCH_SIZE);
                const table = SECTION_TABLE_MAP[section];
                if (!table) continue;

                await bulkInsertRaw(table, chunk, pool, { onDuplicate: false });
              }
            }

            console.log(`✅ Done ${file.name}`);
          } catch (err: any) {
            console.error(`❌ Failed ${file.name}:`, err.message);
          }
        })
      )
    );
  }

}
