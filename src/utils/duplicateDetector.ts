import crypto from 'crypto';
import Logger from '@/core/Logger';

/**
 * OPTIMIZED Duplicate Detection - Memory Efficient
 * Uses short hashes and automatic memory management
 */
export class DuplicateDetector {
  // Use Map with size limits
  private contractHashes = new Map<string, boolean>();
  private roomAllocationHashes = new Map<string, boolean>();
  private inventoryHashes = new Map<string, boolean>();
  private rateHashes = new Map<string, boolean>();
  private supplementHashes = new Map<string, boolean>();
  private occupancyRuleHashes = new Map<string, boolean>();
  private emailSettingHashes = new Map<string, boolean>();
  private rateTagHashes = new Map<string, boolean>();
  private configurationHashes = new Map<string, boolean>();
  private promotionHashes = new Map<string, boolean>();
  private specialRequestHashes = new Map<string, boolean>();
  private groupHashes = new Map<string, boolean>();
  private cancellationPolicyHashes = new Map<string, boolean>();
  private specialConditionHashes = new Map<string, boolean>();
  private roomFeatureHashes = new Map<string, boolean>();
  private pricingRuleHashes = new Map<string, boolean>();
  private taxInfoHashes = new Map<string, boolean>();

  private readonly MAX_SIZE = 500000;
  private stats = {
    totalProcessed: 0,
    duplicatesSkipped: 0,
    uniqueRecords: 0,
    byTable: {} as Record<string, { processed: number; duplicates: number; unique: number }>
  };

  constructor() {
    const tables = [
      'hotel_contracts', 'hotel_room_allocations', 'hotel_inventory', 'hotel_rates',
      'hotel_supplements', 'hotel_occupancy_rules', 'hotel_email_settings', 'hotel_rate_tags',
      'hotel_configurations', 'hotel_promotions', 'hotel_special_requests', 'hotel_groups',
      'hotel_cancellation_policies', 'hotel_special_conditions', 'hotel_room_features',
      'hotel_pricing_rules', 'hotel_tax_info'
    ];
    tables.forEach(t => this.stats.byTable[t] = { processed: 0, duplicates: 0, unique: 0 });
  }

  private hash(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex').slice(-8);
  }

  private check(map: Map<string, boolean>, key: string): boolean {
    if (map.size > this.MAX_SIZE) {
      const toDelete = Array.from(map.keys()).slice(0, Math.floor(map.size / 2));
      toDelete.forEach(k => map.delete(k));
    }
    return map.has(key);
  }

  isContractDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_contracts.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.contract_code}:${data.date_from}`);
    if (this.check(this.contractHashes, h)) {
      this.stats.byTable.hotel_contracts.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.contractHashes.set(h, true);
    this.stats.byTable.hotel_contracts.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isRoomAllocationDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_room_allocations.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.room_code}:${data.board_code}`);
    if (this.check(this.roomAllocationHashes, h)) {
      this.stats.byTable.hotel_room_allocations.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.roomAllocationHashes.set(h, true);
    this.stats.byTable.hotel_room_allocations.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isInventoryDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_inventory.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.room_code}:${data.date_from}`);
    if (this.check(this.inventoryHashes, h)) {
      this.stats.byTable.hotel_inventory.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.inventoryHashes.set(h, true);
    this.stats.byTable.hotel_inventory.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isRateDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_rates.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.room_code}:${data.date_from}:${data.adults}`);
    if (this.check(this.rateHashes, h)) {
      this.stats.byTable.hotel_rates.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.rateHashes.set(h, true);
    this.stats.byTable.hotel_rates.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isSupplementDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_supplements.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.supplement_code}:${data.date_from}`);
    if (this.check(this.supplementHashes, h)) {
      this.stats.byTable.hotel_supplements.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.supplementHashes.set(h, true);
    this.stats.byTable.hotel_supplements.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isOccupancyRuleDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_occupancy_rules.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.rule_from}:${data.rule_to}`);
    if (this.check(this.occupancyRuleHashes, h)) {
      this.stats.byTable.hotel_occupancy_rules.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.occupancyRuleHashes.set(h, true);
    this.stats.byTable.hotel_occupancy_rules.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isEmailSettingDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_email_settings.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.email_type}:${data.room_code}`);
    if (this.check(this.emailSettingHashes, h)) {
      this.stats.byTable.hotel_email_settings.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.emailSettingHashes.set(h, true);
    this.stats.byTable.hotel_email_settings.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isRateTagDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_rate_tags.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.rate_code}:${data.tag_type}`);
    if (this.check(this.rateTagHashes, h)) {
      this.stats.byTable.hotel_rate_tags.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.rateTagHashes.set(h, true);
    this.stats.byTable.hotel_rate_tags.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isConfigurationDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_configurations.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.config_key}:${data.date_from}`);
    if (this.check(this.configurationHashes, h)) {
      this.stats.byTable.hotel_configurations.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.configurationHashes.set(h, true);
    this.stats.byTable.hotel_configurations.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isPromotionDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_promotions.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.promo_code}:${data.date_from}`);
    if (this.check(this.promotionHashes, h)) {
      this.stats.byTable.hotel_promotions.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.promotionHashes.set(h, true);
    this.stats.byTable.hotel_promotions.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isSpecialRequestDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_special_requests.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.request_code}`);
    if (this.check(this.specialRequestHashes, h)) {
      this.stats.byTable.hotel_special_requests.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.specialRequestHashes.set(h, true);
    this.stats.byTable.hotel_special_requests.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isGroupDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_groups.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.group_code}:${data.date_from}`);
    if (this.check(this.groupHashes, h)) {
      this.stats.byTable.hotel_groups.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.groupHashes.set(h, true);
    this.stats.byTable.hotel_groups.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isCancellationPolicyDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_cancellation_policies.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.policy_code}:${data.days_before}`);
    if (this.check(this.cancellationPolicyHashes, h)) {
      this.stats.byTable.hotel_cancellation_policies.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.cancellationPolicyHashes.set(h, true);
    this.stats.byTable.hotel_cancellation_policies.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isSpecialConditionDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_special_conditions.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.condition_code}`);
    if (this.check(this.specialConditionHashes, h)) {
      this.stats.byTable.hotel_special_conditions.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.specialConditionHashes.set(h, true);
    this.stats.byTable.hotel_special_conditions.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isRoomFeatureDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_room_features.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.room_code}:${data.feature_code}`);
    if (this.check(this.roomFeatureHashes, h)) {
      this.stats.byTable.hotel_room_features.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.roomFeatureHashes.set(h, true);
    this.stats.byTable.hotel_room_features.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isPricingRuleDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_pricing_rules.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.rule_code}:${data.date_from}`);
    if (this.check(this.pricingRuleHashes, h)) {
      this.stats.byTable.hotel_pricing_rules.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.pricingRuleHashes.set(h, true);
    this.stats.byTable.hotel_pricing_rules.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  isTaxInfoDuplicate(hotelId: number, data: any): boolean {
    this.stats.byTable.hotel_tax_info.processed++;
    this.stats.totalProcessed++;
    const h = this.hash(`${hotelId}:${data.tax_type}`);
    if (this.check(this.taxInfoHashes, h)) {
      this.stats.byTable.hotel_tax_info.duplicates++;
      this.stats.duplicatesSkipped++;
      return true;
    }
    this.taxInfoHashes.set(h, true);
    this.stats.byTable.hotel_tax_info.unique++;
    this.stats.uniqueRecords++;
    return false;
  }

  getStats() {
    return {
      ...this.stats,
      duplicatePercentage: this.stats.totalProcessed > 0 
        ? ((this.stats.duplicatesSkipped / this.stats.totalProcessed) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  clear() {
    this.contractHashes.clear();
    this.roomAllocationHashes.clear();
    this.inventoryHashes.clear();
    this.rateHashes.clear();
    this.supplementHashes.clear();
    this.occupancyRuleHashes.clear();
    this.emailSettingHashes.clear();
    this.rateTagHashes.clear();
    this.configurationHashes.clear();
    this.promotionHashes.clear();
    this.specialRequestHashes.clear();
    this.groupHashes.clear();
    this.cancellationPolicyHashes.clear();
    this.specialConditionHashes.clear();
    this.roomFeatureHashes.clear();
    this.pricingRuleHashes.clear();
    this.taxInfoHashes.clear();
  }

  logSummary() {
    const stats = this.getStats();
    Logger.info('[DUPLICATE_DETECTOR] Summary:', {
      totalProcessed: stats.totalProcessed.toLocaleString(),
      duplicatesSkipped: stats.duplicatesSkipped.toLocaleString(),
      uniqueRecords: stats.uniqueRecords.toLocaleString(),
      duplicatePercentage: stats.duplicatePercentage
    });
  }
}
