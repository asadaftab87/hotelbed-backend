// import cron from 'node-cron';
// import path from 'path';
// import unzipper from 'unzipper';
// import Logger from '../core/Logger';
// import * as csv from 'csv-parser';
// import axios from 'axios';
// const HOTELBEDS_URL = 'https://aif2.hotelbeds.com/aif2-pub-ws/files/full';
// import fs from 'fs';
// // const fs = require('fs');

// export class CronJob {
//   constructor() {
//     this.scheduleCronJob();
//   }




//   private scheduleCronJob() {
//     // Cron scheduled to every 2 minutes
//     cron.schedule('*/2 * * * *', async () => {
//       Logger.info('[HotelBeds] Starting Fullrates cron job');
//       await this.downloadAndProcess();
//     });
//   }
//   private async downloadAndProcess(): Promise<void> {
//     try {
//       const headers = {
//         // 'X-Username': process.env.HB_USERNAME!,
//         // 'X-Password': process.env.HB_PASSWORD!,
//         'Api-Key': "f513d78a7046ca883c02bd80926aa1b7",
//       };

//       const response = await axios.get(HOTELBEDS_URL, {
//         headers,
//         responseType: 'stream',
//         timeout: 10 * 60 * 1000, // 10 mins
//       });

//       const version = response.headers['x-version'];
//       if (!version) throw new Error('No X-Version found in response.');

//       const zipPath = path.join(__dirname, `../../downloads/hotelbeds_${version}.zip`);
//       const extractPath = path.join(__dirname, `../../downloads/hotelbeds_${version}`);

//       await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

//       const writer = fs.createWriteStream(zipPath);
//       await new Promise((resolve, reject) => {
//         response.data.pipe(writer);
//         writer.on('finish', resolve);
//         writer.on('error', reject);
//       });

//       Logger.info(`[HotelBeds] Zip downloaded: ${zipPath}`);

//       await this.unzipFile(zipPath, extractPath);
//       Logger.info(`[HotelBeds] Zip extracted to: ${extractPath}`);

//       await this.processExtractedFiles(extractPath);

//     } catch (error: any) {
//       Logger.error('[HotelBeds] Error in cron job: ' + error.message);
//     }
//   }

//   private async unzipFile(zipPath: string, extractPath: string): Promise<void> {
//     await fs.createReadStream(zipPath)
//       .pipe(unzipper.Extract({ path: extractPath }))
//       .promise();
//   }

//   private async processExtractedFiles(folderPath: string): Promise<void> {
//     const files = await fs.promises.readdir(folderPath);

//     for (const file of files) {
//       const filePath = path.join(folderPath, file);
//       Logger.info(`[HotelBeds] Processing file: ${file}`);

//       if (file.endsWith('.csv')) {
//         await this.processCSV(filePath);
//       } else {
//         Logger.warn(`[HotelBeds] Unsupported file type: ${file}`);
//       }
//     }
//   }

//   private async processCSV(filePath: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       const results: any[] = [];

//       fs.createReadStream(filePath)
//         .pipe(csv())
//         .on('data', (data) => results.push(data))
//         .on('end', async () => {
//           try {
//             for (const row of results) {
//               console.log(row, "Row")
//               // await insertHotelData(row); // 👈 apna DB insert logic yahan lagayein
//             }
//             Logger.info(`[HotelBeds] Inserted ${results.length} records from ${path.basename(filePath)}`);
//             resolve(true);
//           } catch (err) {
//             reject(err);
//           }
//         })
//         .on('error', reject);
//     });
//   }
// }