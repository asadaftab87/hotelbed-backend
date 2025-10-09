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
  landmarks: Array<{
    id: string;
    name: string;
    type: string;
    distance: number;
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
   */
  async getMatrix(request: MatrixRequest): Promise<MatrixResponse> {
    try {
      // Get hotel info (try SearchIndex first, fallback to HotelMaster)
      let hotel: any = null;
      let hotelName = '';

      try {
        hotel = await prisma.searchIndex.findFirst({
          where: {
            hotelCode: request.hotelId,
          },
        });
        hotelName = hotel?.hotelName || '';
      } catch (err) {
        Logger.debug('SearchIndex not available, trying HotelMaster');
      }

      // Fallback to HotelMaster
      if (!hotel) {
        const hotelMaster = await prisma.hotelMaster.findFirst({
          where: {
            hotelCode: request.hotelId,
          },
        });

        if (!hotelMaster) {
          throw new Error('Hotel not found');
        }

        hotelName = hotelMaster.hotelName || '';
      }

      // Calculate checkout date
      const checkIn = new Date(request.checkIn);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + request.nights);

      // Get all available room types for this hotel
      let rooms: any[] = [];
      
      try {
        rooms = await prisma.room.findMany({
          where: {
            // Find rooms via Contract
            hotelBedId: {
              not: undefined,
            },
          },
          distinct: ['roomCode', 'characteristic'],
          take: 50, // Reasonable limit
        });
      } catch (err) {
        Logger.warn('Room table not available or empty');
      }

      // Get pricing and availability for each room
      const roomMatrices: RoomMatrix[] = [];

      // Only calculate pricing if we have inventory data
      if (rooms.length > 0) {
        for (const room of rooms) {
          try {
            // Calculate pricing for this room (wrapped in try-catch)
            try {
              const pricing = await pricingEngine.calculatePrice({
                hotelCode: request.hotelId,
                checkIn,
                checkOut,
                nights: request.nights,
                occupancy: request.occupancy,
                roomCode: room.roomCode || undefined,
              });

              if (!pricing.isAvailable) {
                continue; // Skip unavailable rooms
              }

              // Get current allotment
              let inventory = null;
              try {
                inventory = await prisma.inventory.findFirst({
                  where: {
                    hotelCode: request.hotelId,
                    roomCode: room.roomCode,
                    calendarDate: checkIn,
                  },
                });
              } catch (err) {
                // Inventory table not available
              }

              roomMatrices.push({
                roomCode: room.roomCode || '',
                roomName: room.roomCode || '',
                characteristic: room.characteristic || '',
                board: pricing.boardCode,
                totalPrice: pricing.totalPrice,
                pricePerPerson: pricing.pricePerPerson,
                currency: pricing.currency,
                nightlyBreakdown: pricing.nightlyBreakdown.map((night) => ({
                  date: night.date.toISOString().split('T')[0],
                  price: night.total,
                })),
                policies: pricing.policies,
                restrictions: pricing.restrictions,
                promotionApplied: pricing.appliedPromotions[0]
                  ? {
                      type: pricing.appliedPromotions[0].type,
                      value: pricing.appliedPromotions[0].value,
                      freeNights:
                        pricing.appliedPromotions[0].type === 'free_nights'
                          ? pricing.appliedPromotions[0].value
                          : undefined,
                    }
                  : undefined,
                combinabilityNote: this.getCombinabilityNote(pricing.appliedPromotions),
                availability: {
                  isAvailable: true,
                  allotment: inventory?.allotment || undefined,
                },
              });
            } catch (pricingError) {
              Logger.warn(`Pricing calculation failed for room ${room.roomCode}, skipping`);
            }
          } catch (error) {
            Logger.error(`Failed to get pricing for room ${room.roomCode}:`, error);
          }
        }
      }

      return {
        hotelId: request.hotelId,
        hotelCode: request.hotelId,
        hotelName: hotelName,
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
        let landmarks: any[] = [];

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

        try {
          landmarks = await prisma.hotelLandmark.findMany({
            where: {
              hotelCode: hotelId,
            },
            include: {
              landmark: true,
            },
          });
        } catch (e) {
          Logger.debug('HotelLandmark table not available');
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
          landmarks: landmarks.map((l) => ({
            id: l.landmarkId,
            name: l.landmark.name,
            type: l.landmark.type,
            distance: l.distanceM,
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

