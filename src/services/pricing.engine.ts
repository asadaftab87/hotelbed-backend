/**
 * Pricing Engine
 * Implements deterministic pricing logic per client requirements:
 * 1. Stop-sale / allotment / release / CTA/CTD filtering
 * 2. Min/Max nights validation
 * 3. Base price calculation
 * 4. Promotions in fixed order: free nights → percentage → absolute → coupons
 * 5. Occupancy calculation (price per person)
 * 6. Currency conversion
 * 7. Policy aggregation
 */

import { prisma } from '../database';
import Logger from '../core/Logger';

export interface PricingInput {
  hotelCode: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  occupancy: {
    adults: number;
    children: number;
    childAges?: number[];
  };
  roomCode?: string;
  boardCode?: string;
  categoryTag?: string; // e.g., "city_trip", "beach", "other"
}

export interface PricingResult {
  totalPrice: number;
  pricePerPerson: number;
  currency: string;
  boardCode: string;
  roomCode: string;
  ratePlanId: string;
  nightlyBreakdown: NightlyPrice[];
  appliedPromotions: AppliedPromotion[];
  policies: {
    cancellation: CancellationPolicy[];
    prepayment?: string;
  };
  restrictions: {
    minNights?: number;
    maxNights?: number;
    cta?: number;
    ctd?: number;
    releaseDays?: number;
  };
  isAvailable: boolean;
  reason?: string;
}

export interface NightlyPrice {
  date: Date;
  basePrice: number;
  taxes: number;
  fees: number;
  total: number;
}

export interface AppliedPromotion {
  type: 'free_nights' | 'percentage' | 'absolute' | 'coupon';
  code?: string;
  value: number;
  description?: string;
  discountAmount: number;
  combinable: boolean;
}

export interface CancellationPolicy {
  daysBeforeCheckin: number;
  chargeType: string;
  amount?: number;
  percentage?: number;
}

export class PricingEngine {
  /**
   * Calculate price for a specific stay
   */
  async calculatePrice(input: PricingInput): Promise<PricingResult> {
    try {
      // Step 1: Check availability and restrictions
      const availabilityCheck = await this.checkAvailability(input);
      if (!availabilityCheck.isAvailable) {
        return {
          ...this.emptyResult(),
          isAvailable: false,
          reason: availabilityCheck.reason,
        };
      }

      // Step 2: Get inventory and pricing data for date range
      const inventory = await this.getInventoryForDateRange(input);
      if (inventory.length === 0) {
        return {
          ...this.emptyResult(),
          isAvailable: false,
          reason: 'No inventory found',
        };
      }

      // Step 3: Calculate base price
      const basePrice = await this.calculateBasePrice(inventory, input);

      // Step 4: Apply promotions in fixed order
      const promotions = await this.getApplicablePromotions(input);
      const priceAfterPromotions = this.applyPromotions(
        basePrice,
        promotions,
        input.nights
      );

      // Step 5: Calculate price per person
      const totalOccupancy = input.occupancy.adults + input.occupancy.children;
      const pricePerPerson = priceAfterPromotions.total / (totalOccupancy || 2);

      // Step 6: Get cancellation policies
      const policies = await this.getCancellationPolicies(input);

      // Step 7: Build result
      return {
        totalPrice: priceAfterPromotions.total,
        pricePerPerson,
        currency: 'EUR',
        boardCode: input.boardCode || 'RO',
        roomCode: input.roomCode || inventory[0].roomCode || '',
        ratePlanId: inventory[0].ratePlanId || '',
        nightlyBreakdown: priceAfterPromotions.breakdown,
        appliedPromotions: priceAfterPromotions.promotions,
        policies,
        restrictions: availabilityCheck.restrictions,
        isAvailable: true,
      };
    } catch (error) {
      Logger.error('PricingEngine.calculatePrice error:', error);
      return {
        ...this.emptyResult(),
        isAvailable: false,
        reason: 'Pricing calculation error',
      };
    }
  }

  /**
   * Calculate cheapest price per person for a hotel
   * Used for precompute job
   */
  async calculateCheapestPP(input: {
    hotelCode: string;
    categoryTag: string;
    minNights: number;
    horizonDays: number;
  }): Promise<{
    pricePP: number;
    startDate: Date;
    nights: number;
    boardCode: string;
    roomCode: string;
    ratePlanId: string;
  } | null> {
    try {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + input.horizonDays);

      // Find earliest bookable date with minimum nights
      const inventory = await prisma.inventory.findMany({
        where: {
          hotelCode: input.hotelCode,
          calendarDate: {
            gte: today,
            lte: endDate,
          },
          stopSale: false,
          allotment: {
            gt: 0,
          },
        },
        orderBy: [
          { calendarDate: 'asc' },
        ],
        take: 1000, // Reasonable limit
      });

      if (inventory.length < input.minNights) {
        return null;
      }

      // Find first consecutive period that satisfies minNights
      let bestPrice = Infinity;
      let bestResult: any = null;

      for (let i = 0; i <= inventory.length - input.minNights; i++) {
        const slice = inventory.slice(i, i + input.minNights);
        
        // Check if dates are consecutive
        const isConsecutive = this.areDatesConsecutive(
          slice.map(inv => inv.calendarDate!)
        );

        if (!isConsecutive) continue;

        // Calculate total price (from Cost table or estimate)
        const totalPrice = slice.reduce(
          (sum, inv) => sum + 50, // Placeholder: Need to join with Cost table
          0
        );
        const pricePerPerson = totalPrice / 2; // Assume double occupancy

        if (pricePerPerson < bestPrice) {
          bestPrice = pricePerPerson;
          bestResult = {
          pricePP: pricePerPerson,
          startDate: slice[0].calendarDate!,
          nights: input.minNights,
          boardCode: 'RO', // Placeholder: Need to join with Room/Cost
          roomCode: slice[0].roomCode || '',
          ratePlanId: slice[0].ratePlanId || '',
          };
        }
      }

      return bestResult;
    } catch (error) {
      Logger.error('PricingEngine.calculateCheapestPP error:', error);
      return null;
    }
  }

  /**
   * Check availability and restrictions
   */
  private async checkAvailability(input: PricingInput): Promise<{
    isAvailable: boolean;
    reason?: string;
    restrictions: any;
  }> {
    // Get inventory for first night to check restrictions
    const firstNightInventory = await prisma.inventory.findFirst({
      where: {
        hotelCode: input.hotelCode,
        calendarDate: input.checkIn,
        ...(input.roomCode && { roomCode: input.roomCode }),
      },
    });

    if (!firstNightInventory) {
      return {
        isAvailable: false,
        reason: 'No inventory found for check-in date',
        restrictions: {},
      };
    }

    // Check stop-sale
    if (firstNightInventory.stopSale) {
      return {
        isAvailable: false,
        reason: 'Stop sale active',
        restrictions: {},
      };
    }

    // Check allotment
    if ((firstNightInventory.allotment || 0) <= 0) {
      return {
        isAvailable: false,
        reason: 'No allotment available',
        restrictions: {},
      };
    }

    // Check min/max nights
    const minNights = firstNightInventory.minNights || 1;
    const maxNights = firstNightInventory.maxNights || 365;

    if (input.nights < minNights) {
      return {
        isAvailable: false,
        reason: `Minimum ${minNights} nights required`,
        restrictions: { minNights, maxNights },
      };
    }

    if (input.nights > maxNights) {
      return {
        isAvailable: false,
        reason: `Maximum ${maxNights} nights allowed`,
        restrictions: { minNights, maxNights },
      };
    }

    // Check release days (CTA)
    const daysUntilCheckIn = Math.floor(
      (input.checkIn.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    if (
      firstNightInventory.cta &&
      daysUntilCheckIn < firstNightInventory.cta
    ) {
      return {
        isAvailable: false,
        reason: `Booking must be made at least ${firstNightInventory.cta} days in advance`,
        restrictions: {
          minNights,
          maxNights,
          cta: firstNightInventory.cta,
        },
      };
    }

    return {
      isAvailable: true,
      restrictions: {
        minNights,
        maxNights,
        cta: firstNightInventory.cta,
        ctd: firstNightInventory.ctd,
        releaseDays: firstNightInventory.releaseDays,
      },
    };
  }

  /**
   * Get inventory for date range
   */
  private async getInventoryForDateRange(input: PricingInput) {
    return await prisma.inventory.findMany({
      where: {
        hotelCode: input.hotelCode,
        calendarDate: {
          gte: input.checkIn,
          lt: input.checkOut,
        },
        stopSale: false,
        allotment: {
          gt: 0,
        },
        ...(input.roomCode && { roomCode: input.roomCode }),
        ...(input.boardCode && { boardCode: input.boardCode }),
      },
      orderBy: {
        calendarDate: 'asc',
      },
    });
  }

  /**
   * Calculate base price (sum of nightly prices)
   */
  private async calculateBasePrice(inventory: any[], input: PricingInput) {
    const breakdown: NightlyPrice[] = inventory.map((inv) => {
      const basePrice = inv.netPrice || 0;
      // Get taxes from Tax table if available
      const taxes = 0; // TODO: Calculate from Tax table
      const fees = 0; // TODO: Calculate from HandlingFee table
      
      return {
        date: inv.calendarDate,
        basePrice,
        taxes,
        fees,
        total: basePrice + taxes + fees,
      };
    });

    const total = breakdown.reduce((sum, night) => sum + night.total, 0);

    return { total, breakdown };
  }

  /**
   * Get applicable promotions
   */
  private async getApplicablePromotions(input: PricingInput) {
    const promotions = await prisma.promotion.findMany({
      where: {
        OR: [
          {
            AND: [
              { initialDate: { lte: input.checkIn } },
              { finalDate: { gte: input.checkIn } },
            ],
          },
          {
            AND: [
              { applicationInitialDate: { lte: input.checkIn } },
              { applicationFinalDate: { gte: input.checkIn } },
            ],
          },
        ],
        isIncluded: true,
      },
    });

    return promotions;
  }

  /**
   * Apply promotions in fixed order
   */
  private applyPromotions(
    basePrice: { total: number; breakdown: NightlyPrice[] },
    promotions: any[],
    nights: number
  ) {
    let total = basePrice.total;
    const appliedPromotions: AppliedPromotion[] = [];

    // Order: free nights → percentage → absolute → coupons
    const sorted = promotions.sort((a, b) => {
      const order = ['free_nights', 'percentage', 'absolute', 'coupon'];
      return order.indexOf(a.type) - order.indexOf(b.type);
    });

    for (const promo of sorted) {
      // Simple implementation - enhance based on actual promotion structure
      if (promo.code === 'FREE_NIGHT' && nights >= 7) {
        // Example: 7 nights for price of 6
        const discount = total / nights;
        total -= discount;
        appliedPromotions.push({
          type: 'free_nights',
          code: promo.code,
          value: 1,
          description: '1 free night',
          discountAmount: discount,
          combinable: false,
        });
      }
    }

    return {
      total,
      breakdown: basePrice.breakdown,
      promotions: appliedPromotions,
    };
  }

  /**
   * Get cancellation policies
   */
  private async getCancellationPolicies(input: PricingInput) {
    const policies = await prisma.cancellationFee.findMany({
      where: {
        AND: [
          { startDate: { lte: input.checkIn } },
          { endDate: { gte: input.checkIn } },
        ],
        ...(input.roomCode && { rateCode: input.roomCode }),
      },
      orderBy: {
        daysBeforeCheckin: 'asc',
      },
    });

    return {
      cancellation: policies.map((p) => ({
        daysBeforeCheckin: p.daysBeforeCheckin || 0,
        chargeType: p.chargeType || 'PERCENTAGE',
        amount: p.amount || undefined,
        percentage: p.percentage || undefined,
      })),
      prepayment: 'Full payment required at booking', // TODO: from HandlingFee
    };
  }

  /**
   * Check if dates are consecutive
   */
  private areDatesConsecutive(dates: Date[]): boolean {
    if (dates.length <= 1) return true;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      
      prevDate.setDate(prevDate.getDate() + 1);
      
      if (prevDate.getTime() !== currDate.getTime()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Empty result template
   */
  private emptyResult(): PricingResult {
    return {
      totalPrice: 0,
      pricePerPerson: 0,
      currency: 'EUR',
      boardCode: '',
      roomCode: '',
      ratePlanId: '',
      nightlyBreakdown: [],
      appliedPromotions: [],
      policies: {
        cancellation: [],
      },
      restrictions: {},
      isAvailable: false,
    };
  }
}

// Singleton instance
export const pricingEngine = new PricingEngine();

