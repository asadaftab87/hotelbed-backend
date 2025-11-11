"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSVGenerator = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fast_csv_1 = require("fast-csv");
const fs_2 = require("fs");
const readline_1 = require("readline");
const Logger_1 = __importDefault(require("@/core/Logger"));
const duplicateDetector_1 = require("./duplicateDetector");
class CSVGenerator {
    constructor(outputDir = '/tmp/hotelbed_csv') {
        this.outputDir = outputDir;
        this.duplicateDetector = new duplicateDetector_1.DuplicateDetector();
        this.ensureOutputDir();
    }
    ensureOutputDir() {
        if (!fs_1.default.existsSync(this.outputDir)) {
            fs_1.default.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    /**
     * Create CSV file streams for all tables
     */
    createCSVWriters() {
        const tables = [
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
        const writers = {};
        for (const table of tables) {
            const filePath = path_1.default.join(this.outputDir, `${table}.csv`);
            const writeStream = fs_1.default.createWriteStream(filePath, {
                highWaterMark: 1024 * 1024 * 128, // 128MB buffer - USE THE 32GB RAM!
                encoding: 'utf8',
                flags: 'w',
            });
            const csvStream = (0, fast_csv_1.format)({ headers: true, quote: '"' });
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
    async closeWriters(writers) {
        const closePromises = Object.values(writers).map((writer) => {
            return new Promise((resolve) => {
                writer.stream.end(() => resolve());
            });
        });
        await Promise.all(closePromises);
    }
    /**
     * Parse hotel file sections
     */
    parseHotelFileSections(content) {
        const sections = {};
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
     * Write contracts to CSV with duplicate detection
     */
    writeContracts(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 13) {
                const data = {
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
                };
                // Skip if duplicate
                if (this.duplicateDetector.isContractDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write room allocations to CSV with duplicate detection
     */
    writeRoomAllocations(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 8) {
                const data = {
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
                };
                // Skip if duplicate
                if (this.duplicateDetector.isRoomAllocationDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write inventory to CSV with duplicate detection
     */
    writeInventory(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 5) {
                const data = {
                    hotel_id: hotelId,
                    room_code: parts[2] || null,
                    board_code: parts[3] || null,
                    date_from: parts[0] || null,
                    date_to: parts[1] || null,
                    availability_data: parts[4] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isInventoryDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write rates to CSV with duplicate detection (LARGEST TABLE - CRITICAL)
     */
    writeRates(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 7) {
                const ratesString = parts[6] || '';
                const rateMatches = ratesString.matchAll(/\(([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^)]+)\)/g);
                for (const rateMatch of rateMatches) {
                    const data = {
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
                    };
                    // Skip if duplicate (CRITICAL for performance)
                    if (this.duplicateDetector.isRateDuplicate(hotelId, data)) {
                        continue;
                    }
                    writer.stream.write(data);
                    writer.count++;
                }
            }
        }
    }
    /**
     * Write supplements to CSV with duplicate detection
     */
    writeSupplements(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 6) {
                const data = {
                    hotel_id: hotelId,
                    date_from: parts[0] || null,
                    date_to: parts[1] || null,
                    supplement_code: parts[3] || null,
                    supplement_type: parts[4] || null,
                    discount_percent: parseFloat(parts[6]) || 0,
                    min_nights: parseInt(parts[8]) || 0,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isSupplementDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write occupancy rules to CSV with duplicate detection
     */
    writeOccupancyRules(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 3) {
                const data = {
                    hotel_id: hotelId,
                    rule_from: parts[0] || null,
                    rule_to: parts[1] || null,
                    is_allowed: parts[2] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isOccupancyRuleDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write email settings to CSV with duplicate detection
     */
    writeEmailSettings(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 7) {
                const data = {
                    hotel_id: hotelId,
                    date_from: parts[1] || null,
                    date_to: parts[2] || null,
                    email_type: parts[3] || null,
                    room_type: parts[5] || null,
                    room_code: parts[6] || null,
                    email_content: parts[8] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isEmailSettingDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write rate tags to CSV with duplicate detection
     */
    writeRateTags(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 3) {
                const data = {
                    hotel_id: hotelId,
                    rate_code: parts[0] || null,
                    tag_type: parts[1] || null,
                    tag_value: parts[2] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isRateTagDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write configurations to CSV with duplicate detection
     */
    writeConfigurations(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 4) {
                const data = {
                    hotel_id: hotelId,
                    config_key: parts[0] || null,
                    config_value: parts[1] || null,
                    date_from: parts[2] || null,
                    date_to: parts[3] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isConfigurationDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write promotions to CSV with duplicate detection
     */
    writePromotions(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 5) {
                const data = {
                    hotel_id: hotelId,
                    promo_code: parts[0] || null,
                    promo_type: parts[1] || null,
                    date_from: parts[2] || null,
                    date_to: parts[3] || null,
                    discount_value: parseFloat(parts[4]) || 0,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isPromotionDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write special requests to CSV with duplicate detection
     */
    writeSpecialRequests(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 3) {
                const data = {
                    hotel_id: hotelId,
                    request_code: parts[0] || null,
                    request_type: parts[1] || null,
                    request_description: parts[2] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isSpecialRequestDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write groups to CSV with duplicate detection
     */
    writeGroups(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 4) {
                const data = {
                    hotel_id: hotelId,
                    group_code: parts[0] || null,
                    group_type: parts[1] || null,
                    date_from: parts[2] || null,
                    date_to: parts[3] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isGroupDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write cancellation policies to CSV with duplicate detection
     */
    writeCancellationPolicies(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 4) {
                const data = {
                    hotel_id: hotelId,
                    policy_code: parts[0] || null,
                    days_before: parseInt(parts[1]) || 0,
                    penalty_percent: parseFloat(parts[2]) || 0,
                    penalty_amount: parseFloat(parts[3]) || 0,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isCancellationPolicyDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write special conditions to CSV with duplicate detection
     */
    writeSpecialConditions(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 3) {
                const data = {
                    hotel_id: hotelId,
                    condition_code: parts[0] || null,
                    condition_type: parts[1] || null,
                    condition_description: parts[2] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isSpecialConditionDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write room features to CSV with duplicate detection
     */
    writeRoomFeatures(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 3) {
                const data = {
                    hotel_id: hotelId,
                    room_code: parts[0] || null,
                    feature_code: parts[1] || null,
                    feature_value: parts[2] || null,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isRoomFeatureDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write pricing rules to CSV with duplicate detection
     */
    writePricingRules(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 5) {
                const data = {
                    hotel_id: hotelId,
                    rule_code: parts[0] || null,
                    rule_type: parts[1] || null,
                    date_from: parts[2] || null,
                    date_to: parts[3] || null,
                    adjustment_value: parseFloat(parts[4]) || 0,
                };
                // Skip if duplicate
                if (this.duplicateDetector.isPricingRuleDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write tax info to CSV with duplicate detection
     */
    writeTaxInfo(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 5) {
                const toDecimal = (value) => {
                    if (!value || value.trim() === '')
                        return null;
                    const num = parseFloat(value);
                    return Number.isNaN(num) ? null : num;
                };
                const toInteger = (value) => {
                    if (!value || value.trim() === '')
                        return null;
                    const num = parseInt(value, 10);
                    return Number.isNaN(num) ? null : num;
                };
                const normalizeFlag = (value) => {
                    if (!value || value.trim() === '')
                        return null;
                    return value.trim().toUpperCase();
                };
                const data = {
                    hotel_id: hotelId,
                    date_from: parts[0] || null,
                    date_to: parts[1] || null,
                    room_code: parts[2] || null,
                    board_code: parts[3] || null,
                    tax_code: parts[4] || null,
                    included_flag: normalizeFlag(parts[5]),
                    max_nights: toInteger(parts[6]),
                    min_age: toInteger(parts[7]),
                    max_age: toInteger(parts[8]),
                    per_night: normalizeFlag(parts[9]),
                    per_pax: normalizeFlag(parts[10]),
                    amount: toDecimal(parts[11]),
                    percentage: toDecimal(parts[12]),
                    currency: parts[13] || null,
                    apply_over: normalizeFlag(parts[14]),
                    market_code: parts[15] || null,
                    legal_text: parts[16] || null,
                };
                if (this.duplicateDetector.isTaxInfoDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Process single hotel detail file using STREAMING (line by line)
     * This avoids loading entire file in memory
     */
    async processHotelFile(writers, filePath, hotelId) {
        return new Promise((resolve) => {
            try {
                const stats = fs_1.default.statSync(filePath);
                if (stats.size > 50 * 1024 * 1024) {
                    Logger_1.default.warn(`[CSV] Skipping large file: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
                    resolve(false);
                    return;
                }
                const fileStream = (0, fs_2.createReadStream)(filePath, {
                    encoding: 'utf-8',
                    highWaterMark: 1024 * 1024 * 16, // 16MB buffer - USE THE 32GB RAM!
                });
                const rl = (0, readline_1.createInterface)({
                    input: fileStream,
                    crlfDelay: Infinity,
                });
                let currentSection = null;
                const currentLines = [];
                let hasError = false;
                rl.on('line', (line) => {
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
                    }
                    catch (error) {
                        Logger_1.default.error(`[CSV] Error processing line in ${filePath}`, { error: error.message });
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
                rl.on('error', (error) => {
                    Logger_1.default.error(`[CSV] Error reading file: ${filePath}`, { error: error.message });
                    resolve(false);
                });
            }
            catch (error) {
                Logger_1.default.error(`[CSV] Failed to process hotel file: ${filePath}`, { error: error.message });
                resolve(false);
            }
        });
    }
    /**
     * Write section data to CSV (helper method)
     */
    writeSectionToCSV(writers, hotelId, section, lines) {
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
                this.writeTaxInfo(writers.hotel_tax_info, hotelId, lines);
                break;
            case 'SIIN':
                this.writeInventoryFromSIIN(writers.hotel_inventory, hotelId, lines);
                break;
            case 'SIAP':
                this.writeRatesFromSIAP(writers.hotel_rates, hotelId, lines);
                break;
        }
    }
    /**
     * Extract hotel ID from filename
     */
    extractHotelIdFromFilename(filename) {
        const parts = filename.split('_');
        if (parts.length >= 4) {
            const secondPart = parts[1];
            if (/^\d+$/.test(secondPart)) {
                const hotelId = parseInt(secondPart);
                if (hotelId > 0)
                    return hotelId;
            }
        }
        const numericParts = parts.filter(part => /^\d+$/.test(part));
        if (numericParts.length >= 2) {
            const hotelId = parseInt(numericParts[1]);
            if (hotelId > 0)
                return hotelId;
        }
        if (numericParts.length > 0) {
            const largestNumeric = numericParts
                .map(p => parseInt(p))
                .filter(n => n > 0)
                .sort((a, b) => b - a)[0];
            if (largestNumeric)
                return largestNumeric;
        }
        const match = filename.match(/(\d+)/);
        return match ? parseInt(match[1]) : null;
    }
    /**
     * Get summary of generated CSV files with duplicate detection stats
     */
    getCSVSummary(writers) {
        const summary = {};
        for (const [table, writer] of Object.entries(writers)) {
            const stats = fs_1.default.statSync(writer.filePath);
            summary[table] = {
                records: writer.count,
                fileSizeMB: (stats.size / 1024 / 1024).toFixed(2),
                filePath: writer.filePath,
            };
        }
        return summary;
    }
    /**
     * Get duplicate detection statistics
     */
    getDuplicateStats() {
        return this.duplicateDetector.getStats();
    }
    /**
     * Log duplicate detection summary
     */
    logDuplicateSummary() {
        this.duplicateDetector.logSummary();
    }
    /**
     * Clear duplicate detector memory
     */
    clearDuplicateDetector() {
        this.duplicateDetector.clear();
    }
    /**
     * Write inventory from SIIN section (contract files)
     */
    writeInventoryFromSIIN(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 6) {
                const data = {
                    hotel_id: hotelId,
                    room_code: parts[3] || null,
                    board_code: parts[4] || null,
                    date_from: parts[0] || null,
                    date_to: parts[1] || null,
                    availability_data: parts[5] || null,
                };
                if (this.duplicateDetector.isInventoryDuplicate(hotelId, data)) {
                    continue;
                }
                writer.stream.write(data);
                writer.count++;
            }
        }
    }
    /**
     * Write rates from SIAP section (contract files)
     */
    writeRatesFromSIAP(writer, hotelId, lines) {
        if (!lines || lines.length === 0)
            return;
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 10) {
                const pricesString = parts[9] || '';
                const priceMatches = pricesString.matchAll(/\(([^,]*),([^,]*),([^)]+)\)/g);
                for (const match of priceMatches) {
                    const price = parseFloat(match[3]);
                    if (price > 0) {
                        const data = {
                            hotel_id: hotelId,
                            room_code: parts[3] || null,
                            board_code: parts[4] || null,
                            date_from: parts[0] || null,
                            date_to: parts[1] || null,
                            rate_type: 'N',
                            base_price: 0,
                            tax_amount: 0,
                            adults: parseInt(parts[6]) || 0,
                            board_type: parts[4] || null,
                            price: price,
                        };
                        if (this.duplicateDetector.isRateDuplicate(hotelId, data)) {
                            continue;
                        }
                        writer.stream.write(data);
                        writer.count++;
                    }
                }
            }
        }
    }
}
exports.CSVGenerator = CSVGenerator;
