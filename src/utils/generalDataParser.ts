import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import Logger from '@/core/Logger';

/**
 * GENERAL Folder Data Parser
 * 
 * Parses master reference data files from the GENERAL folder:
 * - GHOT_F: Hotels master data
 * - IDES_F: Destinations
 * - GCAT_F: Categories
 * - GTTO_F: Chains/Tour Operators
 * 
 * File format: [DEST]_[OFFICE]_[ID]_[TYPE]
 * Example: PMI_1_56548_F
 */

export interface Hotel {
  id: number;
  category: string | null;
  destination_code: string | null;
  chain_code: string | null;
  accommodation_type: string | null;
  ranking: number | null;
  group_hotel: string | null;
  country_code: string | null;
  state_code: string | null;
  longitude: number | null;
  latitude: number | null;
  name: string | null;
}

export interface Destination {
  code: string;
  country_code: string | null;
  is_available: string | null;
  name: string | null;
}

export interface Category {
  code: string;
  type: string | null;
  simple_code: string | null;
  description: string | null;
}

export interface Chain {
  code: string;
  name: string | null;
}

export class GeneralDataParser {
  private generalDir: string;

  constructor(generalDir: string) {
    this.generalDir = generalDir;
  }

  /**
   * Check if GENERAL folder exists
   */
  exists(): boolean {
    return fs.existsSync(this.generalDir);
  }

  /**
   * Parse all GENERAL folder files
   */
  async parseAll(): Promise<{
    hotels: Hotel[];
    destinations: Destination[];
    categories: Category[];
    chains: Chain[];
  }> {
    const startTime = Date.now();

    Logger.info('[GENERAL] Starting GENERAL folder parsing...');

    if (!this.exists()) {
      Logger.warn('[GENERAL] GENERAL folder not found, skipping master data parsing');
      return {
        hotels: [],
        destinations: [],
        categories: [],
        chains: [],
      };
    }

    const [hotels, destinations, categories, chains] = await Promise.all([
      this.parseHotels(),
      this.parseDestinations(),
      this.parseCategories(),
      this.parseChains(),
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    Logger.info('[GENERAL] GENERAL folder parsing complete', {
      hotels: hotels.length,
      destinations: destinations.length,
      categories: categories.length,
      chains: chains.length,
      duration: `${duration}s`,
    });

    return { hotels, destinations, categories, chains };
  }

  /**
   * Parse GHOT_F files (Hotels master data)
   * 
   * Format: {GHOT}
   *         hotel_id:category:destination_code:chain_code:accommodation_type:ranking:group_hotel:country_code:state_code:longitude:latitude:name
   *         {/GHOT}
   */
  async parseHotels(): Promise<Hotel[]> {
    const files = this.findFiles('GHOT_F');
    
    if (files.length === 0) {
      Logger.warn('[GENERAL] No GHOT_F files found');
      return [];
    }

    Logger.info(`[GENERAL] Parsing ${files.length} GHOT_F file(s)...`);

    const allHotels: Hotel[] = [];
    const hotelIds = new Set<number>(); // Track duplicates

    for (const file of files) {
      const hotels = await this.parseGHOTFile(file);
      
      // Deduplicate by hotel ID
      for (const hotel of hotels) {
        if (!hotelIds.has(hotel.id)) {
          hotelIds.add(hotel.id);
          allHotels.push(hotel);
        }
      }
    }

    Logger.info(`[GENERAL] Parsed ${allHotels.length} unique hotels`);
    return allHotels;
  }

  /**
   * Parse single GHOT_F file
   */
  private async parseGHOTFile(filePath: string): Promise<Hotel[]> {
    const hotels: Hotel[] = [];
    let insideGHOT = false;
    const lines: string[] = [];

    const fileStream = createReadStream(filePath, {
      encoding: 'utf-8',
      highWaterMark: 1024 * 1024 * 16, // 16MB buffer
    });

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    return new Promise((resolve, reject) => {
      rl.on('line', (line: string) => {
        const trimmed = line.trim();

        if (trimmed === '{GHOT}') {
          insideGHOT = true;
          lines.length = 0; // Clear previous lines
          return;
        }

        if (trimmed === '{/GHOT}') {
          insideGHOT = false;
          
          // Process accumulated lines
          for (const dataLine of lines) {
            const hotel = this.parseGHOTLine(dataLine);
            if (hotel) {
              hotels.push(hotel);
            }
          }
          
          lines.length = 0; // Clear for next block
          return;
        }

        if (insideGHOT && trimmed) {
          lines.push(trimmed);
        }
      });

      rl.on('close', () => {
        resolve(hotels);
      });

      rl.on('error', (error: any) => {
        Logger.error(`[GENERAL] Error reading GHOT file: ${filePath}`, { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Parse single GHOT line
   * Format: hotel_id:category:destination_code:chain_code:accommodation_type:ranking:group_hotel:country_code:state_code:longitude:latitude:name
   */
  private parseGHOTLine(line: string): Hotel | null {
    const parts = line.split(':');

    // Need at least hotel_id
    if (parts.length < 1) {
      return null;
    }

    const hotelId = parseInt(parts[0]);
    if (isNaN(hotelId) || hotelId <= 0) {
      return null;
    }

    return {
      id: hotelId,
      category: parts[1] || null,
      destination_code: parts[2] || null,
      chain_code: parts[3] || null,
      accommodation_type: parts[4] || null,
      ranking: parts[5] ? parseInt(parts[5]) : null,
      group_hotel: parts[6] || null,
      country_code: parts[7] || null,
      state_code: parts[8] || null,
      longitude: parts[9] ? parseFloat(parts[9]) : null,
      latitude: parts[10] ? parseFloat(parts[10]) : null,
      name: parts[11] || null,
    };
  }

  /**
   * Parse IDES_F files (Destinations)
   * 
   * Format: {IDES}
   *         destination_code:country_code:is_available:name
   *         {/IDES}
   */
  async parseDestinations(): Promise<Destination[]> {
    const files = this.findFiles('IDES_F');
    
    if (files.length === 0) {
      Logger.warn('[GENERAL] No IDES_F files found');
      return [];
    }

    Logger.info(`[GENERAL] Parsing ${files.length} IDES_F file(s)...`);

    const allDestinations: Destination[] = [];
    const destCodes = new Set<string>(); // Track duplicates

    for (const file of files) {
      const destinations = await this.parseIDESFile(file);
      
      // Deduplicate by destination code
      for (const dest of destinations) {
        if (!destCodes.has(dest.code)) {
          destCodes.add(dest.code);
          allDestinations.push(dest);
        }
      }
    }

    Logger.info(`[GENERAL] Parsed ${allDestinations.length} unique destinations`);
    return allDestinations;
  }

  /**
   * Parse single IDES_F file
   */
  private async parseIDESFile(filePath: string): Promise<Destination[]> {
    const destinations: Destination[] = [];
    let insideIDES = false;
    const lines: string[] = [];

    const fileStream = createReadStream(filePath, {
      encoding: 'utf-8',
      highWaterMark: 1024 * 1024 * 16,
    });

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    return new Promise((resolve, reject) => {
      rl.on('line', (line: string) => {
        const trimmed = line.trim();

        if (trimmed === '{IDES}') {
          insideIDES = true;
          lines.length = 0;
          return;
        }

        if (trimmed === '{/IDES}') {
          insideIDES = false;
          
          for (const dataLine of lines) {
            const dest = this.parseIDESLine(dataLine);
            if (dest) {
              destinations.push(dest);
            }
          }
          
          lines.length = 0;
          return;
        }

        if (insideIDES && trimmed) {
          lines.push(trimmed);
        }
      });

      rl.on('close', () => {
        resolve(destinations);
      });

      rl.on('error', (error: any) => {
        Logger.error(`[GENERAL] Error reading IDES file: ${filePath}`, { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Parse single IDES line
   * Format: destination_code:country_code:is_available:name
   */
  private parseIDESLine(line: string): Destination | null {
    const parts = line.split(':');

    // Need at least destination_code
    if (parts.length < 1 || !parts[0]) {
      return null;
    }

    return {
      code: parts[0],
      country_code: parts[1] || null,
      is_available: parts[2] || null,
      name: parts[3] || null,
    };
  }

  /**
   * Parse GCAT_F files (Categories)
   * 
   * Format: {GCAT}
   *         category_code:type:simple_code:description
   *         {/GCAT}
   */
  async parseCategories(): Promise<Category[]> {
    const files = this.findFiles('GCAT_F');
    
    if (files.length === 0) {
      Logger.warn('[GENERAL] No GCAT_F files found');
      return [];
    }

    Logger.info(`[GENERAL] Parsing ${files.length} GCAT_F file(s)...`);

    const allCategories: Category[] = [];
    const catCodes = new Set<string>(); // Track duplicates

    for (const file of files) {
      const categories = await this.parseGCATFile(file);
      
      // Deduplicate by category code
      for (const cat of categories) {
        if (!catCodes.has(cat.code)) {
          catCodes.add(cat.code);
          allCategories.push(cat);
        }
      }
    }

    Logger.info(`[GENERAL] Parsed ${allCategories.length} unique categories`);
    return allCategories;
  }

  /**
   * Parse single GCAT_F file
   */
  private async parseGCATFile(filePath: string): Promise<Category[]> {
    const categories: Category[] = [];
    let insideGCAT = false;
    const lines: string[] = [];

    const fileStream = createReadStream(filePath, {
      encoding: 'utf-8',
      highWaterMark: 1024 * 1024 * 16,
    });

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    return new Promise((resolve, reject) => {
      rl.on('line', (line: string) => {
        const trimmed = line.trim();

        if (trimmed === '{GCAT}') {
          insideGCAT = true;
          lines.length = 0;
          return;
        }

        if (trimmed === '{/GCAT}') {
          insideGCAT = false;
          
          for (const dataLine of lines) {
            const cat = this.parseGCATLine(dataLine);
            if (cat) {
              categories.push(cat);
            }
          }
          
          lines.length = 0;
          return;
        }

        if (insideGCAT && trimmed) {
          lines.push(trimmed);
        }
      });

      rl.on('close', () => {
        resolve(categories);
      });

      rl.on('error', (error: any) => {
        Logger.error(`[GENERAL] Error reading GCAT file: ${filePath}`, { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Parse single GCAT line
   * Format: category_code:type:simple_code:description
   */
  private parseGCATLine(line: string): Category | null {
    const parts = line.split(':');

    // Need at least category_code
    if (parts.length < 1 || !parts[0]) {
      return null;
    }

    return {
      code: parts[0],
      type: parts[1] || null,
      simple_code: parts[2] || null,
      description: parts[3] || null,
    };
  }

  /**
   * Parse GTTO_F files (Chains/Tour Operators)
   * 
   * Format: {GTTO}
   *         chain_code:chain_name
   *         {/GTTO}
   */
  async parseChains(): Promise<Chain[]> {
    const files = this.findFiles('GTTO_F');
    
    if (files.length === 0) {
      Logger.warn('[GENERAL] No GTTO_F files found');
      return [];
    }

    Logger.info(`[GENERAL] Parsing ${files.length} GTTO_F file(s)...`);

    const allChains: Chain[] = [];
    const chainCodes = new Set<string>(); // Track duplicates

    for (const file of files) {
      const chains = await this.parseGTTOFile(file);
      
      // Deduplicate by chain code
      for (const chain of chains) {
        if (!chainCodes.has(chain.code)) {
          chainCodes.add(chain.code);
          allChains.push(chain);
        }
      }
    }

    Logger.info(`[GENERAL] Parsed ${allChains.length} unique chains`);
    return allChains;
  }

  /**
   * Parse single GTTO_F file
   */
  private async parseGTTOFile(filePath: string): Promise<Chain[]> {
    const chains: Chain[] = [];
    let insideGTTO = false;
    const lines: string[] = [];

    const fileStream = createReadStream(filePath, {
      encoding: 'utf-8',
      highWaterMark: 1024 * 1024 * 16,
    });

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    return new Promise((resolve, reject) => {
      rl.on('line', (line: string) => {
        const trimmed = line.trim();

        if (trimmed === '{GTTO}') {
          insideGTTO = true;
          lines.length = 0;
          return;
        }

        if (trimmed === '{/GTTO}') {
          insideGTTO = false;
          
          for (const dataLine of lines) {
            const chain = this.parseGTTOLine(dataLine);
            if (chain) {
              chains.push(chain);
            }
          }
          
          lines.length = 0;
          return;
        }

        if (insideGTTO && trimmed) {
          lines.push(trimmed);
        }
      });

      rl.on('close', () => {
        resolve(chains);
      });

      rl.on('error', (error: any) => {
        Logger.error(`[GENERAL] Error reading GTTO file: ${filePath}`, { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Parse single GTTO line
   * Format: chain_code:chain_name
   */
  private parseGTTOLine(line: string): Chain | null {
    const parts = line.split(':');

    // Need at least chain_code
    if (parts.length < 1 || !parts[0]) {
      return null;
    }

    return {
      code: parts[0],
      name: parts[1] || null,
    };
  }

  /**
   * Find files matching pattern in GENERAL directory
   */
  private findFiles(pattern: string): string[] {
    if (!fs.existsSync(this.generalDir)) {
      return [];
    }

    const files = fs.readdirSync(this.generalDir);
    const matchedFiles = files.filter((f: string) => f.includes(pattern));

    return matchedFiles.map((f: string) => path.join(this.generalDir, f));
  }
}
