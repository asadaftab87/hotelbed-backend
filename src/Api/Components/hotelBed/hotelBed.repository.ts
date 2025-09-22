import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import axios from "axios";
import { prisma } from "../../../database";
import { mapRow } from "../../../utils/mapper";
import { safeCreateMany } from "../../../helpers/safeCreateMany";
import { parseHotelBedsDate } from "../../../utils/parseHotelBedsDate";
import { normalizeRow } from "../../../utils/mapHotelBedsRow";
const HOTELBEDS_URL = 'https://aif2.hotelbeds.com/aif2-pub-ws/files/full';
const BATCH_SIZE = 500;

export default class HotelBedFileRepo {
  static async createFromZip() {
    // const headers = {
    //   "Api-Key": "f513d78a7046ca883c02bd80926aa1b7",
    // };

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
    //   // @ts-ignore
    //   writer.on("finish", resolve);
    //   writer.on("error", reject);
    // });

    // console.log(`[HotelBeds] Zip downloaded: ${zipPath}`);

    // const zip = new AdmZip(zipPath);
    // zip.extractAllTo(extractPath, true);
    // console.log(`📂 Extracted to: ${extractPath}`);

    await this.processDir(extractPath);

    return { result: "Data Feed In DB With Realtions" };
  }
  private static async parseFileToJson(filePath: string) {
    const content = await fs.promises.readFile(filePath, "utf8");
    const sections: Record<string, any[]> = {};
    let currentSection: string | null = null;

    for (const rawLine of content.split(/\r?\n/)) {
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


  private static async processDir(dir: string) {
    const files = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      if (file.isDirectory()) {
        await this.processDir(fullPath);
      } else if (file.isFile()) {
        try {
          const jsonData = await this.parseFileToJson(fullPath);
          const hotelBedFile = await prisma.hotelBedFile.create({ data: { name: file.name } });

          for (const [section, rows] of Object.entries(jsonData)) {
            if (!rows.length) continue;
            // const mappedRows = mapRow(section, rows);
            const mappedRows = mapRow(section, rows).map(r => ({
              hotelBedId: hotelBedFile.id,
              ...r
            }));

            switch (section) {
              case "CCON":
                await safeCreateMany(prisma.contract, mappedRows);
                break;
              case "CNPR":
                await safeCreateMany(prisma.promotion, mappedRows);
                break;
              case "CNHA":
                await safeCreateMany(prisma.room, mappedRows);
                break;
              case "CNIN":
                await safeCreateMany(prisma.restriction, mappedRows);
                break;
              case "CNCT":
                await safeCreateMany(prisma.cost, mappedRows);
                break;
              case "CNEM":
                await safeCreateMany(prisma.minMaxStay, mappedRows);
                break;
              case "CNSR":
                await safeCreateMany(prisma.supplement, mappedRows);
                break;
              case "CNPV":
                await safeCreateMany(prisma.stopSale, mappedRows);
                break;
              case "CNCF":
                await safeCreateMany(prisma.cancellationFee, mappedRows);
                break;
              case "CNTA":
                await safeCreateMany(prisma.rateCode, mappedRows);
                break;
              case "CNES":
                await safeCreateMany(prisma.extraStay, mappedRows);
                break;
              case "CNSU":
                await safeCreateMany(prisma.extraSupplement, mappedRows);
                break;
              case "CNGR":
                await safeCreateMany(prisma.group, mappedRows);
                break;
              case "CNOE":
                await safeCreateMany(prisma.offer, mappedRows);
                break;
              case "SIIN":
                await safeCreateMany(prisma.serviceInfoIn, mappedRows);
                break;
              case "SIAP":
                await safeCreateMany(prisma.serviceInfoAp, mappedRows);
                break;
              case "SICF":
                await safeCreateMany(prisma.serviceInfoCf, mappedRows);
                break;
              case "SIA":
                await safeCreateMany(prisma.serviceInfoA, mappedRows);
                break;
              default:
                console.log(`⚠️ Unknown section ${section}`);
            }
          }

          console.log(`✅ Inserted all sections for file ${file.name}`);
        } catch (err: any) {
          console.error(`❌ Failed to parse ${file.name}:`, err.message);
        }
      }
    }
  }
}
