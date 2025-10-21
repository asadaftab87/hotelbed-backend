import { HotelBedFileRepository } from './hotelBed.repository';
import Logger from '@/core/Logger';

export class HotelBedFileService {
  private readonly repository: HotelBedFileRepository;

  constructor() {
    this.repository = new HotelBedFileRepository();
  }

  /**
   * Import only from existing extracted folder (Development)
   * @param folderName Optional folder name, will find latest if not provided
   * @returns Import result
   */
  async importOnly(folderName?: string): Promise<any> {
    const serviceStartTime = Date.now();

    try {
      Logger.info('[SERVICE] Starting direct import from existing folder');

      const extractedPath = await this.repository.findExtractedFolder(folderName);
      
      Logger.info('[SERVICE] Found extracted folder', { path: extractedPath });

      // Direct import (no download, no extract)
      Logger.info('[SERVICE] Step 1/1: Importing data to database');
      const importResult = await this.repository.importToDatabase(extractedPath);
      Logger.info('[SERVICE] Database import completed', {
        totalRecords: importResult.totalRecords,
        duration: importResult.duration
      });

      const totalDuration = ((Date.now() - serviceStartTime) / 1000).toFixed(2);

      Logger.info('[SERVICE] Direct import finished successfully', {
        totalDuration: `${totalDuration}s`
      });

      return {
        success: true,
        import: importResult,
        totalDuration: `${totalDuration}s`,
        timestamp: new Date()
      };
    } catch (error: any) {
      Logger.error('[SERVICE] Direct import failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Download and extract HotelBeds cache file
   * @returns Combined result with download and extraction details
   */
  async downloadCache(): Promise<any> {
    const serviceStartTime = Date.now();
    
    try {
      Logger.info('[SERVICE] Starting HotelBeds cache download and extraction process');

      // Step 1: Download
      Logger.info('[SERVICE] Step 1/2: Downloading cache file');
      const downloadResult = await this.repository.downloadCacheZip();
      Logger.info('[SERVICE] Download completed', {
        fileName: downloadResult.fileName,
        fileSize: downloadResult.fileSizeMB,
        duration: downloadResult.duration
      });

      // Step 2: Extract
      Logger.info('[SERVICE] Step 2/3: Extracting cache file');
      const extractResult = await this.repository.extractZipFile(downloadResult.filePath);
      Logger.info('[SERVICE] Extraction completed', {
        totalFiles: extractResult.totalFiles,
        extractedFiles: extractResult.extractedFiles,
        jsonFiles: extractResult.filesSummary.jsonFiles,
        duration: extractResult.duration
      });

      // Step 3: Import to Database
      Logger.info('[SERVICE] Step 3/3: Importing data to database');
      const importResult = await this.repository.importToDatabase(extractResult.extractedPath);
      Logger.info('[SERVICE] Database import completed', {
        totalRecords: importResult.totalRecords,
        hotels: importResult.results.hotels.imported,
        categories: importResult.results.categories.imported,
        chains: importResult.results.chains.imported,
        duration: importResult.duration
      });

      const totalDuration = ((Date.now() - serviceStartTime) / 1000).toFixed(2);

      Logger.info('[SERVICE] Complete process finished successfully', {
        totalDuration: `${totalDuration}s`,
        downloadDuration: downloadResult.duration,
        extractionDuration: extractResult.duration,
        importDuration: importResult.duration
      });

      return {
        success: true,
        download: {
          fileName: downloadResult.fileName,
          filePath: downloadResult.filePath,
          fileSize: downloadResult.fileSizeMB,
          duration: downloadResult.duration
        },
        extraction: {
          extractedPath: extractResult.extractedPath,
          extractedFolder: extractResult.extractedFolder,
          totalFiles: extractResult.totalFiles,
          extractedFiles: extractResult.extractedFiles,
          filesSummary: extractResult.filesSummary,
          duration: extractResult.duration
        },
        import: {
          totalRecords: importResult.totalRecords,
          results: importResult.results,
          duration: importResult.duration
        },
        totalDuration: `${totalDuration}s`,
        timestamp: new Date()
      };
    } catch (error: any) {
      Logger.error('[SERVICE] Process failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get hotels with optional pagination and filters
   */
  async getHotels(page?: number, limit?: number, filters?: any): Promise<any> {
    try {
      Logger.info('[SERVICE] Fetching hotels', { page, limit, filters });
      
      const result = await this.repository.getHotels(page, limit, filters);
      
      if (page !== undefined && limit !== undefined) {
        Logger.info('[SERVICE] Hotels fetched successfully (paginated)', {
          count: result.data.length,
          page: result.pagination.page,
          total: result.pagination.total
        });
      } else {
        Logger.info('[SERVICE] Hotels fetched successfully (all)', {
          count: result.data.length,
          total: result.total
        });
      }
      
      return result;
    } catch (error: any) {
      Logger.error('[SERVICE] Error fetching hotels', { error: error.message });
      throw error;
    }
  }

  /**
   * Get single hotel by ID (basic info only)
   */
  async getHotelById(hotelId: number): Promise<any> {
    try {
      Logger.info('[SERVICE] Fetching hotel by ID', { hotelId });
      
      const hotel = await this.repository.getHotelById(hotelId);
      
      if (!hotel) {
        Logger.warn('[SERVICE] Hotel not found', { hotelId });
        return null;
      }
      
      Logger.info('[SERVICE] Hotel fetched successfully', { hotelId });
      return hotel;
    } catch (error: any) {
      Logger.error('[SERVICE] Error fetching hotel by ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Get complete hotel details with ALL related data (NO limits)
   */
  async getHotelFullDetails(hotelId: number): Promise<any> {
    try {
      Logger.info('[SERVICE] Fetching complete hotel details (ALL data)', { hotelId });
      
      const hotel = await this.repository.getHotelFullDetails(hotelId);
      
      if (!hotel) {
        Logger.warn('[SERVICE] Hotel not found', { hotelId });
        return null;
      }
      
      Logger.info('[SERVICE] Complete hotel details fetched successfully (ALL data)', { 
        hotelId,
        totalRooms: hotel.summary?.totalRooms || 0,
        totalRates: hotel.summary?.totalRates || 0,
        totalInventory: hotel.summary?.totalInventory || 0,
        totalContracts: hotel.summary?.totalContracts || 0,
        totalCancellationPolicies: hotel.summary?.totalCancellationPolicies || 0,
        totalSupplements: hotel.summary?.totalSupplements || 0,
        totalRateTags: hotel.summary?.totalRateTags || 0,
        totalOccupancyRules: hotel.summary?.totalOccupancyRules || 0,
        totalEmailSettings: hotel.summary?.totalEmailSettings || 0,
        totalConfigurations: hotel.summary?.totalConfigurations || 0,
        totalPromotions: hotel.summary?.totalPromotions || 0,
        totalSpecialRequests: hotel.summary?.totalSpecialRequests || 0,
        totalGroups: hotel.summary?.totalGroups || 0,
        totalSpecialConditions: hotel.summary?.totalSpecialConditions || 0,
        totalRoomFeatures: hotel.summary?.totalRoomFeatures || 0,
        totalPricingRules: hotel.summary?.totalPricingRules || 0,
        totalTaxInfo: hotel.summary?.totalTaxInfo || 0
      });
      
      return hotel;
    } catch (error: any) {
      Logger.error('[SERVICE] Error fetching complete hotel details', { error: error.message });
      throw error;
    }
  }

  /**
   * Get hotel rates with pagination
   */
  async getHotelRates(hotelId: number, page: number, limit: number): Promise<any> {
    try {
      Logger.info('[SERVICE] Fetching hotel rates', { hotelId, page, limit });
      
      const result = await this.repository.getHotelRates(hotelId, page, limit);
      
      Logger.info('[SERVICE] Hotel rates fetched successfully', {
        hotelId,
        count: result.data.length,
        total: result.pagination.total
      });
      
      return result;
    } catch (error: any) {
      Logger.error('[SERVICE] Error fetching hotel rates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get destinations with pagination
   */
  async getDestinations(page: number, limit: number): Promise<any> {
    try {
      Logger.info('[SERVICE] Fetching destinations', { page, limit });
      
      const result = await this.repository.getDestinations(page, limit);
      
      Logger.info('[SERVICE] Destinations fetched successfully', {
        count: result.data.length,
        total: result.pagination.total
      });
      
      return result;
    } catch (error: any) {
      Logger.error('[SERVICE] Error fetching destinations', { error: error.message });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    try {
      Logger.info('[SERVICE] Fetching database stats');
      
      const stats = await this.repository.getDatabaseStats();
      
      Logger.info('[SERVICE] Database stats fetched successfully');
      return stats;
    } catch (error: any) {
      Logger.error('[SERVICE] Error fetching database stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Compute cheapest prices - always ALL hotels
   */
  async computeCheapestPrices(category: string = 'ALL', hotelId?: number): Promise<any> {
    try {
      Logger.info('[SERVICE] 🔥 Starting', { category, hotelId });
      
      const result = await this.repository.computeCheapestPrices(category, hotelId);
      
      Logger.info('[SERVICE] ✅ Done', {
        processed: result.processed,
        computed: result.computed,
        speed: result.speed
      });
      
      return result;
    } catch (error: any) {
      Logger.error('[SERVICE] Error', { error: error.message });
      throw error;
    }
  }

  /**
   * Search hotels with cheapest prices
   */
  async searchHotels(filters: any, sort: string, page: number, limit: number): Promise<any> {
    try {
      Logger.info('[SERVICE] Searching hotels', { filters, sort, page, limit });
      
      const result = await this.repository.searchHotels(filters, sort, page, limit);
      
      Logger.info('[SERVICE] Search completed', {
        count: result.data.length,
        total: result.pagination.total
      });
      
      return result;
    } catch (error: any) {
      Logger.error('[SERVICE] Search error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get available rooms for a hotel
   */
  async getAvailableRooms(hotelId: number, checkIn?: string, nights?: number, page: number = 1, limit: number = 10, maxDates: number = 10): Promise<any> {
    try {
      Logger.info('[SERVICE] Getting available rooms', { hotelId, checkIn, nights, page, limit, maxDates });
      
      const result = await this.repository.getAvailableRooms(hotelId, checkIn, nights, page, limit, maxDates);
      
      Logger.info('[SERVICE] Available rooms fetched', { 
        roomsCount: result.data.length,
        total: result.pagination.total
      });
      
      return result;
    } catch (error: any) {
      Logger.error('[SERVICE] Error getting available rooms', { error: error.message });
      throw error;
    }
  }

  /**
   * Check availability - Get all available rooms for dates
   */
  async checkAvailability(hotelId: number, checkIn: string, nights: number, roomCode?: string): Promise<any> {
    try {
      Logger.info('[SERVICE] Checking availability', { hotelId, checkIn, nights, roomCode });
      
      const result = await this.repository.checkAvailability(hotelId, checkIn, nights, roomCode);
      
      Logger.info('[SERVICE] Availability checked', { roomsFound: result.rooms?.length || 0 });
      
      return result;
    } catch (error: any) {
      Logger.error('[SERVICE] Error checking availability', { error: error.message });
      throw error;
    }
  }
}
