import { Response, Request, NextFunction } from "express";
import asyncHandler from "../../../helpers/async";
import HotelBedFileRepo from './hotelBed.repository';
import HotelBedTurboRepo from './hotelBed.repository.turbo';
import { BadRequestError } from '../../../core/ApiError';
import { SuccessResponse } from '../../../core/ApiResponse';
import HotelBedFile from './hotelBed'
import { CreateCouplePayloadDTO } from "../../../Interface/payloadInterface";
import axios from "axios";
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip'
import { mapRow } from "../../../utils/mapper";
import { prisma } from "../../../database";

const DOWNLOADS_DIR = path.join(__dirname, "../../../../downloads");
const JSON_DIR = path.join(DOWNLOADS_DIR, "json");
const HOTELBEDS_URL = 'https://aif2.hotelbeds.com/aif2-pub-ws/files/full';

export class HotelBedFileController {

  // getAll = asyncHandler(
  //   async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
  //     const result = await HotelBedFileRepo.find();
  //     new SuccessResponse('fetch success', result).send(res);
  //   }
  // )

  // getById = asyncHandler(
  //   async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  //     const result = await HotelBedFileRepo.findById(req.params.id);
  //     new SuccessResponse('fetch success', result).send(res);
  //   }
  // )

  // create = asyncHandler(
  //   async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
  //     let bodyData: CreateCouplePayloadDTO = req.body
  //     const { id: userId } = req.user
  //     // @ts-ignore
  //     const result = await HotelBedFileRepo.create({ ...bodyData, userId });
  //     new SuccessResponse('create success', result).send(res);
  //   }
  // )

  // update = asyncHandler(
  //   async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
  //     let bodyData: CreateCouplePayloadDTO = req.body
  //     const { id: userId } = req.user
  //     const { coupleId } = req.params
  //     // @ts-ignore
  //     const result = await HotelBedFileRepo.update(coupleId, { ...bodyData, userId });
  //     new SuccessResponse('update success', result).send(res);
  //   }
  // )
  /**
   * 🚀 TURBO ENDPOINT - Complete End-to-End Flow
   * 
   * This single endpoint does EVERYTHING:
   * 1. Clean Database (if full mode)
   * 2. Download ZIP from Hotelbeds
   * 3. Extract ZIP
   * 4. Process all CONTRACT files (Raw SQL)
   * 5. Build Inventory table (complex logic)
   * 6. Process GENERAL files (HotelMaster, BoardMaster)
   * 7. Run Precompute Service
   * 8. Update SearchIndex
   * 9. Cleanup temporary files
   * 
   * Expected Duration: 5-10 minutes for full feed
   */
  getFullData = asyncHandler(
    async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
      const mode = (req.query.mode as "full" | "update") || "full";
      
      // Execute complete TURBO flow
      const result = await HotelBedFileRepo.createFromZip(mode);
      // const result = await HotelBedTurboRepo.executeFullFlow(mode);
      
      new SuccessResponse(
        "🚀 TURBO: Complete end-to-end flow finished successfully!",
        result
      ).send(res);
    }
  )

  /**
   * 🔄 Manual Precompute Endpoint
   * Run this AFTER data is in database
   * Calculates "From € p.p." prices for all hotels
   */
  runPrecompute = asyncHandler(
    async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
      const { precomputeService } = require('../../../services/precompute.service');
      
      // Run full precompute
      const result = await precomputeService.runFullPrecompute();
      
      new SuccessResponse(
        "✅ Precompute completed successfully!",
        result
      ).send(res);
    }
  )

  /**
   * 📊 Manual Search Index Update
   * Run this AFTER precompute
   * Updates SearchIndex table for fast queries
   */
  updateSearchIndex = asyncHandler(
    async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
      const { precomputeService } = require('../../../services/precompute.service');
      
      // Update search index
      const updated = await precomputeService.updateSearchIndex();
      
      new SuccessResponse(
        "✅ Search Index updated successfully!",
        { hotelsUpdated: updated }
      ).send(res);
    }
  )

  /**
   * 🏗️ Manual Inventory Build
   * Run this to build Inventory table from current database data
   * Useful for partial data demos (e.g., at 18% completion)
   * Cleans old inventory first, then builds fresh from current data
   */
  buildInventory = asyncHandler(
    async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
      const startTime = Date.now();
      
      // Clean old inventory and build fresh from current database data
      await HotelBedFileRepo.rebuildInventory();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      new SuccessResponse(
        "✅ Inventory table rebuilt successfully!",
        { 
          message: "Old inventory cleaned and rebuilt from current database data",
          duration: `${duration}s` 
        }
      ).send(res);
    }
  )

  // delete = asyncHandler(
  //   async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  //     const { coupleId } = req.params
  //     const result = await HotelBedFileRepo.delete(coupleId);
  //     new SuccessResponse('delete success', result).send(res);
  //   }
  // )


  // getAllData = asyncHandler(
  //   async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
  //     try {
  //       const headers = {
  //         "Api-Key": "f513d78a7046ca883c02bd80926aa1b7",
  //       };

  //       const response = await axios.get(HOTELBEDS_URL, {
  //         headers,
  //         responseType: "stream",
  //       });

  //       const version = response.headers["x-version"];
  //       if (!version) throw new Error("No X-Version found in response.");

  //       const zipPath = path.join(__dirname, `../../../../downloads/hotelbeds.zip`);
  //       const extractPath = path.join(__dirname, `../../../../downloads/hotelbeds`);

  //       await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

  //       const writer = fs.createWriteStream(zipPath);
  //       await new Promise((resolve, reject) => {
  //         response.data.pipe(writer);
  //         // @ts-ignore
  //         writer.on("finish", resolve);
  //         writer.on("error", reject);
  //       });

  //       console.log(`[HotelBeds] Zip downloaded: ${zipPath}`);

  //       const zip = new AdmZip(zipPath);
  //       zip.extractAllTo(extractPath, true);
  //       console.log(`📂 Extracted to: ${extractPath}`);

  //       async function parseFileToJson(filePath: string) {
  //         const content = await fs.promises.readFile(filePath, "utf8");
  //         const sections: Record<string, any[]> = {};
  //         let currentSection: string | null = null;

  //         for (const rawLine of content.split(/\r?\n/)) {
  //           const line = rawLine.trim();
  //           if (!line) continue;

  //           if (line.startsWith("{") && !line.startsWith("{/")) {
  //             currentSection = line.replace(/[{}]/g, "");
  //             sections[currentSection] = [];
  //           } else if (line.startsWith("{/")) {
  //             currentSection = null;
  //           } else if (currentSection) {
  //             const parts = line.split(":");
  //             const row: Record<string, string> = {};
  //             parts.forEach((val, i) => {
  //               row[`field_${i}`] = val;
  //             });
  //             sections[currentSection].push(row);
  //           }
  //         }

  //         return sections;
  //       }

  //       const processDir = async (dir: string) => {
  //         const files = await fs.promises.readdir(dir, { withFileTypes: true });

  //         for (const file of files) {
  //           const fullPath = path.join(dir, file.name);

  //           if (file.isDirectory()) {
  //             await processDir(fullPath);
  //           } else if (file.isFile()) {
  //             try {
  //               const jsonData = await parseFileToJson(fullPath);

  //               const hotelBedFile = await prisma.hotelBedFile.create({
  //                 data: {
  //                   name: file.name,
  //                 },
  //               });

  //               for (const [section, rows] of Object.entries(jsonData)) {
  //                 if (rows.length === 0) continue;

  //                 const mappedRows = mapRow(section, rows);

  //                 switch (section) {
  //                   case "CCON":
  //                     await prisma.contract.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNPR":
  //                     await prisma.promotion.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNHA":
  //                     await prisma.room.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNIN":
  //                     await prisma.restriction.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNCT":
  //                     await prisma.cost.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNEM":
  //                     await prisma.minMaxStay.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNSR":
  //                     await prisma.supplement.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNPV":
  //                     await prisma.stopSale.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNCF":
  //                     await prisma.cancellationFee.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   case "CNTA":
  //                     await prisma.rateCode.createMany({
  //                       data: mappedRows.map((r) => ({ hotelBedId: hotelBedFile.id, ...r })),
  //                     });
  //                     break;
  //                   default:
  //                     console.log(`⚠️ Unknown section ${section}`);
  //                 }
  //               }

  //               console.log(`✅ Inserted all sections for file ${file.name}`);
  //             } catch (err) {
  //               console.error(`❌ Failed to parse ${file.name}:`, (err as Error).message);
  //             }
  //           }
  //         }
  //       };

  //       await processDir(extractPath);
  //       console.log("🎉 All files inserted into SQL via Prisma!");
  //     } catch (error: any) {
  //       console.error("❌ Error:", error.message);
  //       throw error;
  //     }
  //   }
  // )

}
