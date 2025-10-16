/**
 * Hotels Service
 * Implements /hotels/{id}/matrix and /hotels/static endpoints
 * Per client requirements (Section 6 of checklist)
 */

import { prisma } from '../../../database';
import Logger from '../../../core/Logger';
import { pricingEngine, PricingResult } from '../../../services/pricing.engine';

export interface MatrixRequest {
  hotelId: string;
  checkIn: string; // YYYY-MM-DD
  nights: number;
  occupancy: {
    adults: number;
    children: number;
    childAges?: number[];
  };
}

export interface MatrixResponse {
  hotelId: string;
  hotelCode: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  occupancy: {
    adults: number;
    children: number;
  };
  rooms: RoomMatrix[];
}

export interface RoomMatrix {
  roomCode: string;
  roomName: string;
  characteristic: string;
  board: string;
  totalPrice: number;
  pricePerPerson: number;
  currency: string;
  nightlyBreakdown: Array<{
    date: string;
    price: number;
  }>;
  policies: {
    cancellation: Array<{
      daysBeforeCheckin: number;
      chargeType: string;
      amount?: number;
      percentage?: number;
    }>;
    prepayment?: string;
  };
  restrictions: {
    minNights?: number;
    maxNights?: number;
    cta?: number;
    ctd?: number;
    releaseDays?: number;
  };
  promotionApplied?: {
    type: string;
    value: number;
    freeNights?: number;
  };
  combinabilityNote?: string;
  availability: {
    isAvailable: boolean;
    allotment?: number;
  };
}

export interface StaticDataRequest {
  hotelIds: string[]; // comma-separated or array
}

export interface StaticDataResponse {
  hotels: HotelStaticData[];
}

export interface HotelStaticData {
  hotelId: string;
  hotelCode: string;
  name: string;
  description?: string;
  category: string;
  chain?: string;
  accommodationType?: string;
  location: {
    country: string;
    destination: string;
    latitude?: number;
    longitude?: number;
  };
  distances?: {
    beach?: number;
    center?: number;
  };
  amenities: Array<{
    code: string;
    name?: string;
  }>;
  photos?: string[]; // URLs (if available)
  rating?: number;
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
}

export class HotelsService {
  /**
   * Get hotel matrix (room details with pricing)
   * NEW: Uses CheapestPricePerPerson for reliable data (same as GET ALL)
   */
  async getMatrix(request: MatrixRequest): Promise<MatrixResponse> {
    try {
      // Get hotel info
      const hotelMaster = await prisma.hotelMaster.findFirst({
        where: { hotelCode: request.hotelId },
      });

      if (!hotelMaster) {
        throw new Error('Hotel not found');
      }

      // Calculate checkout date
      const checkIn = new Date(request.checkIn);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + request.nights);

      // Get prices from CheapestPricePerPerson for this hotel & nights
      const prices = await prisma.cheapestPricePerPerson.findMany({
        where: {
          hotelCode: request.hotelId,
          nights: request.nights,
          startDate: {
            gte: checkIn,
            lte: checkOut,
          },
        },
        orderBy: { pricePP: 'asc' },
        take: 50,
      }).catch(() => []);

      // Get board types
      const boardsData = await prisma.boardMaster.findMany({
        select: {
          boardCode: true,
          boardType: true,
          boardName: true,
        },
      }).catch(() => []);
      const boardsMap = new Map(boardsData.map(b => [b.boardCode, b]));

      // Get inventory for availability info
      const inventoryData = await prisma.inventory.findMany({
        where: {
          hotelCode: request.hotelId,
          calendarDate: {
            gte: checkIn,
            lte: checkOut,
          },
        },
      }).catch(() => []);

      // Build room matrices from price data
      const roomMatrices: RoomMatrix[] = prices.map(priceData => {
        const boardData = boardsMap.get(priceData.boardCode || '');
        
        // Find inventory for this room
        const roomInventory = inventoryData.filter(
          inv => inv.roomCode === priceData.roomCode
        );
        
        // Calculate nightly breakdown (simplified - same price per night)
        const nightlyBreakdown = [];
        const pricePerNight = priceData.pricePP ? parseFloat(priceData.pricePP as any) * 2 / request.nights : 0;
        for (let i = 0; i < request.nights; i++) {
          const night = new Date(checkIn);
          night.setDate(night.getDate() + i);
          nightlyBreakdown.push({
            date: night.toISOString().split('T')[0],
            price: pricePerNight,
          });
        }

        return {
          roomCode: priceData.roomCode || 'UNKNOWN',
          roomName: priceData.roomCode || 'Standard Room',
          characteristic: '',
          board: priceData.boardCode || 'RO',
          totalPrice: priceData.pricePP ? parseFloat(priceData.pricePP as any) * 2 : 0,
          pricePerPerson: priceData.pricePP ? parseFloat(priceData.pricePP as any) : 0,
          currency: priceData.currency || 'EUR',
          nightlyBreakdown,
          policies: {
            cancellation: [], // Simplified - would need CancellationFee table
            prepayment: undefined,
          },
          restrictions: {
            minNights: roomInventory[0]?.minNights || undefined,
            maxNights: roomInventory[0]?.maxNights || undefined,
            cta: roomInventory[0]?.cta || undefined,
            ctd: roomInventory[0]?.ctd || undefined,
            releaseDays: roomInventory[0]?.releaseDays || undefined,
          },
          promotionApplied: undefined, // Simplified
          combinabilityNote: undefined,
          availability: {
            isAvailable: roomInventory.some(inv => !inv.stopSale && (inv.allotment || 0) > 0),
            allotment: roomInventory.length > 0 
              ? Math.round(roomInventory.reduce((sum, inv) => sum + (inv.allotment || 0), 0) / roomInventory.length)
              : undefined,
          },
        };
      });

      return {
        hotelId: request.hotelId,
        hotelCode: request.hotelId,
        hotelName: hotelMaster.hotelName || '',
        checkIn: request.checkIn,
        checkOut: checkOut.toISOString().split('T')[0],
        nights: request.nights,
        occupancy: {
          adults: request.occupancy.adults,
          children: request.occupancy.children,
        },
        rooms: roomMatrices,
      };
    } catch (error) {
      Logger.error('HotelsService.getMatrix error:', error);
      throw error;
    }
  }

  /**
   * Get static hotel data
   */
  async getStaticData(request: StaticDataRequest): Promise<StaticDataResponse> {
    try {
      const hotels: HotelStaticData[] = [];

      for (const hotelId of request.hotelIds) {
        // Get hotel master data
        const hotelMaster = await prisma.hotelMaster.findFirst({
          where: {
            hotelCode: hotelId,
          },
        });

        if (!hotelMaster) {
          Logger.warn(`Hotel ${hotelId} not found`);
          continue;
        }

        // Try to get additional data (fallback if tables don't exist)
        let searchIndex = null;
        let amenities: any[] = [];

        try {
          searchIndex = await prisma.searchIndex.findFirst({
            where: {
              hotelCode: hotelId,
            },
          });
        } catch (e) {
          Logger.debug('SearchIndex table not available');
        }

        try {
          amenities = await prisma.hotelAmenity.findMany({
            where: {
              hotelCode: hotelId,
            },
          });
        } catch (e) {
          Logger.debug('HotelAmenity table not available');
        }

        hotels.push({
          hotelId,
          hotelCode: hotelId,
          name: hotelMaster.hotelName || '',
          description: undefined, // Not in current schema
          category: hotelMaster.hotelCategory || '',
          chain: hotelMaster.chainCode || undefined,
          accommodationType: hotelMaster.accommodationType || undefined,
          location: {
            country: hotelMaster.countryCode || '',
            destination: hotelMaster.destinationCode || '',
            latitude: searchIndex?.latitude || undefined,
            longitude: searchIndex?.longitude || undefined,
          },
          distances: {
            beach: searchIndex?.beachDistanceM || undefined,
            center: searchIndex?.centerDistanceM || undefined,
          },
          amenities: amenities.map((a) => ({
            code: a.amenityCode,
            name: a.amenityName || undefined,
          })),
          photos: [], // Not in current schema
          rating: searchIndex?.rating || undefined,
          contact: {
            phone: undefined,
            email: undefined,
            website: undefined,
          },
        });
      }

      return { hotels };
    } catch (error) {
      Logger.error('HotelsService.getStaticData error:', error);
      throw error;
    }
  }

  /**
   * Enrich hotels list with COMPLETE A-Z details
   */
  async enrichHotelsList(hotels: any[]): Promise<any[]> {
    try {
      const hotelCodes = hotels.map(h => h.hotelCode);
      
      if (hotelCodes.length === 0) return hotels;
      
      // Fetch ALL data in parallel for maximum performance
      const [
        allPrices,
        hotelMasters,
        inventoryData,
        boardsData,
        promotionsData,
        contractsData,
      ] = await Promise.all([
        // 1. All price entries (different rooms, boards, dates)
        prisma.cheapestPricePerPerson.findMany({
          where: { hotelCode: { in: hotelCodes } },
          orderBy: [{ hotelCode: 'asc' }, { pricePP: 'asc' }],
          take: 5000,
        }).catch(() => []),
        
        // 2. Hotel Master data (location, coordinates, etc.)
        prisma.hotelMaster.findMany({
          where: { hotelCode: { in: hotelCodes } },
          select: {
            hotelCode: true,
            hotelName: true,
            latitude: true,
            longitude: true,
            hotelCategory: true,
            destinationCode: true,
            countryCode: true,
            accommodationType: true,
            chainCode: true,
            ranking: true,
          },
        }).catch(() => []),
        
        // 3. Inventory/Availability (kis din available hai)
        prisma.inventory.findMany({
          where: {
            hotelCode: { in: hotelCodes },
            calendarDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Next 1 year
            },
          },
          select: {
            hotelCode: true,
            roomCode: true,
            calendarDate: true,
            allotment: true,
            stopSale: true,
            releaseDays: true,
            minNights: true,
            maxNights: true,
            cta: true,
            ctd: true,
          },
          orderBy: { calendarDate: 'asc' },
          take: 10000,
        }).catch(() => []),
        
        // 4. Board types
        prisma.boardMaster.findMany({
          select: {
            boardCode: true,
            boardType: true,
            boardName: true,
          },
        }).catch(() => []),
        
        // 5. Active promotions
        prisma.promotion.findMany({
          where: {
            isIncluded: true,
            finalDate: { gte: new Date() },
          },
          select: {
            code: true,
            description: true,
            initialDate: true,
            finalDate: true,
            applicationInitialDate: true,
            applicationFinalDate: true,
          },
          take: 100,
        }).catch(() => []),
        
        // 6. Contract data for additional info
        prisma.contract.findMany({
          where: { hotelCode: { in: hotelCodes } },
          select: {
            hotelCode: true,
            contractName: true,
            initialDate: true,
            endDate: true,
            currency: true,
            baseBoard: true,
            releaseDays: true,
            minChildAge: true,
            maxChildAge: true,
          },
          take: 1000,
        }).catch(() => []),
      ]);

      // Create lookup maps
      const pricesByHotel = new Map<string, any[]>();
      const inventoryByHotel = new Map<string, any[]>();
      const hotelMasterMap = new Map(hotelMasters.map(h => [h.hotelCode, h]));
      const boardsMap = new Map(boardsData.map(b => [b.boardCode, b]));
      const contractsByHotel = new Map<string, any[]>();

      // Group data by hotel
      for (const price of allPrices) {
        if (!pricesByHotel.has(price.hotelCode)) {
          pricesByHotel.set(price.hotelCode, []);
        }
        pricesByHotel.get(price.hotelCode)!.push(price);
      }

      for (const inv of inventoryData) {
        if (!inv.hotelCode) continue;
        if (!inventoryByHotel.has(inv.hotelCode)) {
          inventoryByHotel.set(inv.hotelCode, []);
        }
        inventoryByHotel.get(inv.hotelCode)!.push(inv);
      }

      for (const contract of contractsData) {
        if (!contract.hotelCode) continue;
        if (!contractsByHotel.has(contract.hotelCode)) {
          contractsByHotel.set(contract.hotelCode, []);
        }
        contractsByHotel.get(contract.hotelCode)!.push(contract);
      }

      // Enrich each hotel with COMPLETE details
      const enriched = await Promise.all(hotels.map(async (hotel) => {
        const hotelCode = hotel.hotelCode;
        const hotelMaster = hotelMasterMap.get(hotelCode);
        const hotelPrices = pricesByHotel.get(hotelCode) || [];
        const hotelInventory = inventoryByHotel.get(hotelCode) || [];
        const hotelContracts = contractsByHotel.get(hotelCode) || [];

        // Build location info
        const location = {
          latitude: hotelMaster?.latitude ? parseFloat(hotelMaster.latitude as any) : null,
          longitude: hotelMaster?.longitude ? parseFloat(hotelMaster.longitude as any) : null,
          destinationCode: hotelMaster?.destinationCode || hotel.destinationCode,
          countryCode: hotelMaster?.countryCode || hotel.countryCode,
        };

        // Build hotel info
        const hotelInfo = {
          hotelName: hotelMaster?.hotelName || hotel.hotelName,
          hotelCategory: hotelMaster?.hotelCategory || null,
          accommodationType: hotelMaster?.accommodationType || hotel.accommodationType,
          chainCode: hotelMaster?.chainCode || null,
          ranking: hotelMaster?.ranking || null,
        };

        // Build availability calendar (kis din available hai)
        const availabilityCalendar = hotelInventory.map(inv => ({
          date: inv.calendarDate?.toISOString().split('T')[0],
          roomCode: inv.roomCode,
          available: !inv.stopSale && (inv.allotment || 0) > 0,
          allotment: inv.allotment || 0,
          minNights: inv.minNights,
          maxNights: inv.maxNights,
          releaseDays: inv.releaseDays,
          closeToArrival: inv.cta,
          closeToDeparture: inv.ctd,
        }));

        // Build room options with complete details
        const rooms = hotelPrices.slice(0, 30).map(priceData => {
          const boardData = boardsMap.get(priceData.boardCode || '');
          
          // Calculate end date
          const startDate = new Date(priceData.startDate);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + priceData.nights);
          
          // Find matching inventory for this room
          const roomInventory = hotelInventory.filter(
            inv => inv.roomCode === priceData.roomCode
          );
          
          return {
            roomCode: priceData.roomCode,
            pricing: {
              pricePerPerson: priceData.pricePP ? parseFloat(priceData.pricePP as any) : null,
              totalPrice: priceData.pricePP ? parseFloat(priceData.pricePP as any) * 2 : null,
              currency: priceData.currency || 'EUR',
              nights: priceData.nights,
              adults: 2,
              children: 0,
            },
            boardType: {
              code: priceData.boardCode,
              name: boardData?.boardName || priceData.boardCode,
              type: boardData?.boardType || null,
            },
            dateRange: {
              startDate: priceData.startDate?.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
            },
            availability: {
              totalDays: roomInventory.length,
              hasAvailability: roomInventory.some(inv => !inv.stopSale && (inv.allotment || 0) > 0),
              avgAllotment: roomInventory.length > 0 
                ? Math.round(roomInventory.reduce((sum, inv) => sum + (inv.allotment || 0), 0) / roomInventory.length)
                : 0,
            },
            categoryTag: priceData.categoryTag,
            ratePlanId: priceData.ratePlanId,
            contractId: priceData.contractId,
          };
        });

        // Contract info
        const contracts = hotelContracts.slice(0, 5).map(c => ({
          name: c.contractName,
          validFrom: c.initialDate?.toISOString().split('T')[0],
          validTo: c.endDate?.toISOString().split('T')[0],
          currency: c.currency,
          baseBoard: c.baseBoard,
          releaseDays: c.releaseDays,
          childAgeRange: {
            min: c.minChildAge,
            max: c.maxChildAge,
          },
        }));

        return {
          ...hotel,
          ...hotelInfo,
          location,
          rooms,
          totalRoomOptions: hotelPrices.length,
          availabilityCalendar: availabilityCalendar.slice(0, 90), // Next 90 days
          totalAvailableDays: availabilityCalendar.filter(a => a.available).length,
          contracts,
          promotions: promotionsData.slice(0, 5).map(p => ({
            code: p.code,
            description: p.description,
            validFrom: p.initialDate?.toISOString().split('T')[0],
            validTo: p.finalDate?.toISOString().split('T')[0],
            bookingPeriod: {
              from: p.applicationInitialDate?.toISOString().split('T')[0],
              to: p.applicationFinalDate?.toISOString().split('T')[0],
            },
          })),
        };
      }));

      return enriched;
    } catch (error) {
      Logger.error('Error enriching hotels list:', error);
      // Return original hotels if enrichment fails
      return hotels;
    }
  }

  /**
   * Get combinability note for promotions
   */
  private getCombinabilityNote(promotions: any[]): string | undefined {
    if (promotions.length === 0) return undefined;
    if (promotions.length === 1) return undefined;

    const combinable = promotions.filter((p) => p.combinable);
    if (combinable.length > 0) {
      return `${combinable.length} promotions combined`;
    }

    return 'Non-combinable promotion applied';
  }
}

// Singleton instance
export const hotelsService = new HotelsService();

