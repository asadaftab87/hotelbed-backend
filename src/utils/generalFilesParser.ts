import fs from 'fs';
import path from 'path';
import { format } from 'fast-csv';
import Logger from '@/core/Logger';

export class GeneralFilesParser {
  /**
   * Process GENERAL folder files (GHOT_F, IDES_F, GCAT_F) and write to CSV
   */
  static async processGeneralFiles(generalPath: string, outputDir: string): Promise<void> {
    Logger.info('[GENERAL] Processing GENERAL folder files...');

    // Process GHOT_F (Hotels)
    const ghotPath = path.join(generalPath, 'GHOT_F');
    if (fs.existsSync(ghotPath)) {
      await this.processGHOT(ghotPath, path.join(outputDir, 'hotels.csv'));
    }

    // Process IDES_F (Destinations)
    const idesPath = path.join(generalPath, 'IDES_F');
    if (fs.existsSync(idesPath)) {
      await this.processIDES(idesPath, path.join(outputDir, 'destinations.csv'));
    }

    // Process GCAT_F (Categories)
    const gcatPath = path.join(generalPath, 'GCAT_F');
    if (fs.existsSync(gcatPath)) {
      await this.processGCAT(gcatPath, path.join(outputDir, 'categories.csv'));
    }

    Logger.info('[GENERAL] ✅ GENERAL files processed');
  }

  /**
   * Process GHOT_F file - Hotels with real names
   */
  private static async processGHOT(filePath: string, outputPath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l && !l.startsWith('{'));

    const writeStream = fs.createWriteStream(outputPath);
    const csvStream = format({ headers: true });
    csvStream.pipe(writeStream);

    let count = 0;
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 12) {
        csvStream.write({
          id: parts[0],
          category: parts[1] || null,
          destination_code: parts[2] || null,
          chain_code: parts[3] || null,
          accommodation_type: parts[5] || null,
          ranking: parts[6] || null,
          group_hotel: parts[7] || null,
          country_code: parts[8] || null,
          state_code: null,
          longitude: parts[9] || null,
          latitude: parts[10] || null,
          name: parts[11] ? parts[11].trim() : null
        });
        count++;
      }
    }

    csvStream.end();
    await new Promise<void>(resolve => writeStream.on('finish', () => resolve()));
    Logger.info(`[GHOT] ✅ Wrote ${count} hotels`);
  }

  /**
   * Process IDES_F file - Destinations
   */
  private static async processIDES(filePath: string, outputPath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l && !l.startsWith('{'));

    const writeStream = fs.createWriteStream(outputPath);
    const csvStream = format({ headers: true });
    csvStream.pipe(writeStream);

    let count = 0;
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 3) {
        csvStream.write({
          code: parts[0],
          country_code: parts[1],
          is_available: parts[2]
        });
        count++;
      }
    }

    csvStream.end();
    await new Promise<void>(resolve => writeStream.on('finish', () => resolve()));
    Logger.info(`[IDES] ✅ Wrote ${count} destinations`);
  }

  /**
   * Process GCAT_F file - Categories
   */
  private static async processGCAT(filePath: string, outputPath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l && !l.startsWith('{'));

    const writeStream = fs.createWriteStream(outputPath);
    const csvStream = format({ headers: true });
    csvStream.pipe(writeStream);

    let count = 0;
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 3) {
        csvStream.write({
          code: parts[0],
          simple_code: parts[2]
        });
        count++;
      }
    }

    csvStream.end();
    await new Promise<void>(resolve => writeStream.on('finish', () => resolve()));
    Logger.info(`[GCAT] ✅ Wrote ${count} categories`);
  }
}
