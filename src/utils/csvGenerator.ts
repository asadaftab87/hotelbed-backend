import fs from 'fs';
import path from 'path';
import { format } from 'fast-csv';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import Logger from '@/core/Logger';

export class CSVGenerator {
  private readonly outputDir: string;

  constructor(outputDir: string = '/tmp/hotelbed_csv') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  private ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Create CSV file streams for all tables
   * UPDATED: Added GENERAL folder tables (chains, categories, destinations, hotels)
   */
  createCSVWriters() {
    const tables = [
      // GENERAL folder tables (master data) - MUST be first for load order
      'chains',
      'categories',
      'destinations',
      'hotels',
      
      // DESTINATIONS folder tables (hotel-specific data)
      'hotel_contracts',
      'hotel_room_allocations',
      'hotel_inventory',
      'hotel_rates',
      'hotel_supplements',
      'hotel_occupancy_rules',
      'hotel_email_settings',
      'hotel_rate_tags',
      'hotel_configurations',
      'hotel_promotions',
      'hotel_special_requests',
      'hotel_groups',
      'hotel_cancellation_policies',
      'hotel_special_conditions',
      'hotel_room_features',
      'hotel_pricing_rules',
      'hotel_tax_info',
    ];

    const writers: Record<string, any> = {};

    for (const table of tables) {
      const filePath = path.join(this.outputDir, `${table}.csv`);
      const writeStream = fs.createWriteStream(filePath, {
        highWaterMark: 1024 * 1024 * 128, // 128MB buffer - USE THE 32GB RAM!
        encoding: 'utf8',
        flags: 'w',
      });
      const csvStream = format({ headers: true, quote: '"' });
      
      csvStream.pipe(writeStream);
      
      writers[table] = {
        stream: csvStream,
        filePath: filePath,
        count: 0,
      };
    }

    return writers;
  }

  /**
   * Close all CSV writers
   */
  async closeWriters(writers: Record<string, any>) {
    const closePromises = Object.values(writers).map((writer) => {
      return new Promise<void>((resolve) => {
        writer.stream.end(() => resolve());
      });
    });

    await Promise.all(closePromises);
  }

  /**
   * Parse hotel file sections
   */
  parseHotelFileSections(content: string): any {
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
   * Write contracts to CSV
   */
  writeContracts(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 13) {
        writer.stream.write({
          hotel_id: hotelId,
          destination_code: parts[1] || null,
          contract_code: parts[2] || null,
          rate_code: parts[3] || null,
          board_code: parts[4] || null,
          contract_type: parts[5] || null,
          date_from: parts[9] || null,
          date_to: parts[10] || null,
          currency: parts[12] || null,
          board_type: parts[13] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write room allocations to CSV
   */
  writeRoomAllocations(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 8) {
        writer.stream.write({
          hotel_id: hotelId,
          room_code: parts[0] || null,
          board_code: parts[1] || null,
          min_adults: parseInt(parts[2]) || 0,
          max_adults: parseInt(parts[3]) || 0,
          min_children: parseInt(parts[4]) || 0,
          max_children: parseInt(parts[5]) || 0,
          min_pax: parseInt(parts[6]) || 0,
          max_pax: parseInt(parts[7]) || 0,
          allocation: parseInt(parts[8]) || 0,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write inventory to CSV
   */
  writeInventory(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 5) {
        writer.stream.write({
          hotel_id: hotelId,
          room_code: parts[2] || null,
          board_code: parts[3] || null,
          date_from: parts[0] || null,
          date_to: parts[1] || null,
          availability_data: parts[4] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write rates to CSV (LARGEST TABLE)
   * OPTIMIZED: De-duplicates identical rate tuples (365 days with same price = 1 row)
   */
  writeRates(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 7) {
        const ratesString = parts[6] || '';
        const rateMatches = ratesString.matchAll(/\(([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^)]+)\)/g);

        // Use Set to deduplicate identical rates on same date range
        const uniqueRates = new Set<string>();

        for (const rateMatch of rateMatches) {
          // Create unique key: rate_type|base|tax|adults|board|price
          const rateKey = `${rateMatch[1]}|${rateMatch[2]}|${rateMatch[3]}|${rateMatch[4]}|${rateMatch[5]}|${rateMatch[6]}`;
          
          if (!uniqueRates.has(rateKey)) {
            uniqueRates.add(rateKey);
            
            writer.stream.write({
              hotel_id: hotelId,
              room_code: parts[2] || null,
              board_code: parts[3] || null,
              date_from: parts[0] || null,
              date_to: parts[1] || null,
              rate_type: rateMatch[1] || null,
              base_price: parseFloat(rateMatch[2]) || 0,
              tax_amount: parseFloat(rateMatch[3]) || 0,
              adults: parseInt(rateMatch[4]) || 0,
              board_type: rateMatch[5] || null,
              price: parseFloat(rateMatch[6]) || 0,
            });
            writer.count++;
          }
        }
      }
    }
  }

  /**
   * Write supplements to CSV
   */
  writeSupplements(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 6) {
        writer.stream.write({
          hotel_id: hotelId,
          date_from: parts[0] || null,
          date_to: parts[1] || null,
          supplement_code: parts[3] || null,
          supplement_type: parts[4] || null,
          discount_percent: parseFloat(parts[6]) || 0,
          min_nights: parseInt(parts[8]) || 0,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write occupancy rules to CSV
   */
  writeOccupancyRules(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 3) {
        writer.stream.write({
          hotel_id: hotelId,
          rule_from: parts[0] || null,
          rule_to: parts[1] || null,
          is_allowed: parts[2] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write email settings to CSV
   */
  writeEmailSettings(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 7) {
        writer.stream.write({
          hotel_id: hotelId,
          date_from: parts[1] || null,
          date_to: parts[2] || null,
          email_type: parts[3] || null,
          room_type: parts[5] || null,
          room_code: parts[6] || null,
          email_content: parts[8] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write rate tags to CSV
   */
  writeRateTags(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 3) {
        writer.stream.write({
          hotel_id: hotelId,
          rate_code: parts[0] || null,
          tag_type: parts[1] || null,
          tag_value: parts[2] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write configurations to CSV
   */
  writeConfigurations(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 4) {
        writer.stream.write({
          hotel_id: hotelId,
          config_key: parts[0] || null,
          config_value: parts[1] || null,
          date_from: parts[2] || null,
          date_to: parts[3] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write promotions to CSV
   */
  writePromotions(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 5) {
        writer.stream.write({
          hotel_id: hotelId,
          promo_code: parts[0] || null,
          promo_type: parts[1] || null,
          date_from: parts[2] || null,
          date_to: parts[3] || null,
          discount_value: parseFloat(parts[4]) || 0,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write special requests to CSV
   */
  writeSpecialRequests(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 3) {
        writer.stream.write({
          hotel_id: hotelId,
          request_code: parts[0] || null,
          request_type: parts[1] || null,
          request_description: parts[2] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write groups to CSV
   */
  writeGroups(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 4) {
        writer.stream.write({
          hotel_id: hotelId,
          group_code: parts[0] || null,
          group_type: parts[1] || null,
          date_from: parts[2] || null,
          date_to: parts[3] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write cancellation policies to CSV
   */
  writeCancellationPolicies(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 4) {
        writer.stream.write({
          hotel_id: hotelId,
          policy_code: parts[0] || null,
          days_before: parseInt(parts[1]) || 0,
          penalty_percent: parseFloat(parts[2]) || 0,
          penalty_amount: parseFloat(parts[3]) || 0,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write special conditions to CSV
   */
  writeSpecialConditions(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 3) {
        writer.stream.write({
          hotel_id: hotelId,
          condition_code: parts[0] || null,
          condition_type: parts[1] || null,
          condition_description: parts[2] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write room features to CSV
   */
  writeRoomFeatures(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 3) {
        writer.stream.write({
          hotel_id: hotelId,
          room_code: parts[0] || null,
          feature_code: parts[1] || null,
          feature_value: parts[2] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write pricing rules to CSV
   */
  writePricingRules(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 5) {
        writer.stream.write({
          hotel_id: hotelId,
          rule_code: parts[0] || null,
          rule_type: parts[1] || null,
          date_from: parts[2] || null,
          date_to: parts[3] || null,
          adjustment_value: parseFloat(parts[4]) || 0,
        });
        writer.count++;
      }
    }
  }

  /**
   * Write tax info to CSV
   * ATAX format: 17+ fields per Hotelbeds spec
   * Format: date_from:date_to:room_code:board_code:tax_code:included_flag:min_nights:max_nights:
   *         min_age:max_age:per_night:per_person:amount:percentage:currency:apply_over:market:legal_text
   */
  writeTaxInfo(writer: any, hotelId: number, lines: string[]) {
    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 17) {
        writer.stream.write({
          hotel_id: hotelId,
          date_from: parts[0] || null,
          date_to: parts[1] || null,
          room_code: parts[2] || null,
          board_code: parts[3] || null,
          tax_code: parts[4] || null,
          included_flag: parts[5] || null,
          min_nights: parseInt(parts[6]) || null,
          max_nights: parseInt(parts[7]) || null,
          min_age: parseInt(parts[8]) || null,
          max_age: parseInt(parts[9]) || null,
          per_night: parts[10] || null,
          per_person: parts[11] || null,
          amount: parseFloat(parts[12]) || 0,
          percentage: parseFloat(parts[13]) || 0,
          currency: parts[14] || null,
          apply_over: parts[15] || null,
          market: parts[16] || null,
          legal_text: parts[17] || null,
        });
        writer.count++;
      }
    }
  }

  /**
   * Process single hotel detail file using STREAMING (line by line)
   * This avoids loading entire file in memory
   */
  async processHotelFile(writers: Record<string, any>, filePath: string, hotelId: number): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > 50 * 1024 * 1024) {
          Logger.warn(`[CSV] Skipping large file: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
          resolve(false);
          return;
        }

        const fileStream = createReadStream(filePath, {
          encoding: 'utf-8',
          highWaterMark: 1024 * 1024 * 16, // 16MB buffer - USE THE 32GB RAM!
        });
        const rl = createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        let currentSection: string | null = null;
        const currentLines: string[] = [];
        let hasError = false;

        rl.on('line', (line: string) => {
          try {
            // Check for section start: {SECTION}
            const sectionStartMatch = line.match(/^\{([A-Z]+)\}$/);
            if (sectionStartMatch) {
              // Process previous section before starting new one
              if (currentSection && currentLines.length > 0) {
                this.writeSectionToCSV(writers, hotelId, currentSection, currentLines);
                currentLines.length = 0; // Clear array
              }
              currentSection = sectionStartMatch[1];
              return;
            }

            // Check for section end: {/SECTION}
            const sectionEndMatch = line.match(/^\{\/([A-Z]+)\}$/);
            if (sectionEndMatch && currentSection) {
              // Process section
              if (currentLines.length > 0) {
                this.writeSectionToCSV(writers, hotelId, currentSection, currentLines);
                currentLines.length = 0;
              }
              currentSection = null;
              return;
            }

            // Accumulate line if we're in a section
            if (currentSection && line.trim()) {
              currentLines.push(line.trim());
            }
          } catch (error: any) {
            Logger.error(`[CSV] Error processing line in ${filePath}`, { error: error.message });
            hasError = true;
          }
        });

        rl.on('close', () => {
          // Process last section if any
          if (currentSection && currentLines.length > 0) {
            this.writeSectionToCSV(writers, hotelId, currentSection, currentLines);
          }
          resolve(!hasError);
        });

        rl.on('error', (error: any) => {
          Logger.error(`[CSV] Error reading file: ${filePath}`, { error: error.message });
          resolve(false);
        });
      } catch (error: any) {
        Logger.error(`[CSV] Failed to process hotel file: ${filePath}`, { error: error.message });
        resolve(false);
      }
    });
  }

  /**
   * Write section data to CSV (helper method)
   */
  private writeSectionToCSV(writers: Record<string, any>, hotelId: number, section: string, lines: string[]) {
    switch (section) {
      case 'CCON':
        this.writeContracts(writers.hotel_contracts, hotelId, lines);
        break;
      case 'CNHA':
        this.writeRoomAllocations(writers.hotel_room_allocations, hotelId, lines);
        break;
      case 'CNIN':
        this.writeInventory(writers.hotel_inventory, hotelId, lines);
        break;
      case 'CNCT':
        this.writeRates(writers.hotel_rates, hotelId, lines);
        break;
      case 'CNSU':
        this.writeSupplements(writers.hotel_supplements, hotelId, lines);
        break;
      case 'CNOE':
        this.writeOccupancyRules(writers.hotel_occupancy_rules, hotelId, lines);
        break;
      case 'CNEM':
        this.writeEmailSettings(writers.hotel_email_settings, hotelId, lines);
        break;
      case 'CNTA':
        this.writeRateTags(writers.hotel_rate_tags, hotelId, lines);
        break;
      case 'CNCF':
        this.writeConfigurations(writers.hotel_configurations, hotelId, lines);
        break;
      case 'CNPV':
        this.writePromotions(writers.hotel_promotions, hotelId, lines);
        break;
      case 'CNSR':
        this.writeSpecialRequests(writers.hotel_special_requests, hotelId, lines);
        break;
      case 'CNGR':
        this.writeGroups(writers.hotel_groups, hotelId, lines);
        break;
      case 'CNCL':
        this.writeCancellationPolicies(writers.hotel_cancellation_policies, hotelId, lines);
        break;
      case 'CNES':
        this.writeSpecialConditions(writers.hotel_special_conditions, hotelId, lines);
        break;
      case 'CNHF':
        this.writeRoomFeatures(writers.hotel_room_features, hotelId, lines);
        break;
      case 'CNPR':
        this.writePricingRules(writers.hotel_pricing_rules, hotelId, lines);
        break;
      case 'ATAX':
        if (lines && lines.length > 0) {
          Logger.info(`[CSV] Found ATAX data for hotel ${hotelId}: ${lines.length} lines`);
        }
        this.writeTaxInfo(writers.hotel_tax_info, hotelId, lines);
        break;
    }
  }

  /**
   * Extract hotel ID from filename
   */
  extractHotelIdFromFilename(filename: string): number | null {
    const parts = filename.split('_');
    
    if (parts.length >= 4) {
      const secondPart = parts[1];
      if (/^\d+$/.test(secondPart)) {
        const hotelId = parseInt(secondPart);
        if (hotelId > 0) return hotelId;
      }
    }

    const numericParts = parts.filter(part => /^\d+$/.test(part));
    if (numericParts.length >= 2) {
      const hotelId = parseInt(numericParts[1]);
      if (hotelId > 0) return hotelId;
    }

    if (numericParts.length > 0) {
      const largestNumeric = numericParts
        .map(p => parseInt(p))
        .filter(n => n > 0)
        .sort((a, b) => b - a)[0];
      if (largestNumeric) return largestNumeric;
    }

    const match = filename.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Get summary of generated CSV files
   */
  getCSVSummary(writers: Record<string, any>) {
    const summary: any = {};
    const emptyTables: string[] = [];
    
    for (const [table, writer] of Object.entries(writers)) {
      const stats = fs.statSync(writer.filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      summary[table] = {
        records: writer.count,
        fileSizeMB: sizeMB,
        filePath: writer.filePath,
      };

      // Track empty tables
      if (writer.count === 0) {
        emptyTables.push(table);
      }
    }

    // Log warnings for empty tables
    if (emptyTables.length > 0) {
      Logger.warn(`[CSV] Empty tables (no data in source files): ${emptyTables.join(', ')}`);
      Logger.info(`[CSV] This is normal if source data doesn't contain these sections (e.g., ATAX, CNHF)`);
    }

    return summary;
  }

  // ============================================
  // GENERAL FOLDER CSV WRITERS (NEW)
  // ============================================

  /**
   * Write hotels to CSV (from GHOT_F files)
   */
  writeHotels(writer: any, hotels: any[]) {
    if (!hotels || hotels.length === 0) return;

    for (const hotel of hotels) {
      writer.stream.write({
        id: hotel.id,
        category: hotel.category || null,
        destination_code: hotel.destination_code || null,
        chain_code: hotel.chain_code || null,
        accommodation_type: hotel.accommodation_type || null,
        ranking: hotel.ranking || null,
        group_hotel: hotel.group_hotel || null,
        country_code: hotel.country_code || null,
        state_code: hotel.state_code || null,
        longitude: hotel.longitude || null,
        latitude: hotel.latitude || null,
        name: hotel.name || null,
      });
      writer.count++;
    }
  }

  /**
   * Write destinations to CSV (from IDES_F files)
   */
  writeDestinations(writer: any, destinations: any[]) {
    if (!destinations || destinations.length === 0) return;

    for (const dest of destinations) {
      writer.stream.write({
        code: dest.code,
        country_code: dest.country_code || null,
        is_available: dest.is_available || null,
        name: dest.name || null,
      });
      writer.count++;
    }
  }

  /**
   * Write categories to CSV (from GCAT_F files)
   */
  writeCategories(writer: any, categories: any[]) {
    if (!categories || categories.length === 0) return;

    for (const cat of categories) {
      writer.stream.write({
        code: cat.code,
        type: cat.type || null,
        simple_code: cat.simple_code || null,
        description: cat.description || null,
      });
      writer.count++;
    }
  }

  /**
   * Write chains to CSV (from GTTO_F files)
   */
  writeChains(writer: any, chains: any[]) {
    if (!chains || chains.length === 0) return;

    for (const chain of chains) {
      writer.stream.write({
        code: chain.code,
        name: chain.name || null,
      });
      writer.count++;
    }
  }
}

