import fs from 'fs';
import path from 'path';
import Logger from '@/core/Logger';

export class GHOTParser {
  /**
   * Parse GHOT_F file and return hotel data with correct names
   */
  static parseGHOTFile(ghotFilePath: string): Map<number, any> {
    const hotels = new Map<number, any>();

    try {
      if (!fs.existsSync(ghotFilePath)) {
        Logger.warn('[GHOT] File not found:', ghotFilePath);
        return hotels;
      }

      const content = fs.readFileSync(ghotFilePath, 'utf8');
      const lines = content.split('\n').filter(l => l && !l.startsWith('{'));

      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 12) {
          const id = parseInt(parts[0]);
          const hotel = {
            id,
            category: parts[1] || null,
            destination_code: parts[2] || null,
            chain_code: parts[3] || null,
            accommodation_type: parts[5] || null,
            ranking: parts[6] ? parseInt(parts[6]) : null,
            group_hotel: parts[7] || null,
            country_code: parts[8] || null,
            state_code: parts[9] || null,
            longitude: parts[10] ? parseFloat(parts[10]) : null,
            latitude: parts[11] ? parseFloat(parts[11]) : null,
            name: parts[12] ? parts[12].trim() : `Property ${id}`
          };
          hotels.set(id, hotel);
        }
      }

      Logger.info(`[GHOT] Parsed ${hotels.size} hotels from GHOT_F`);
    } catch (error: any) {
      Logger.error('[GHOT] Parse error:', error.message);
    }

    return hotels;
  }

  /**
   * Write hotels to CSV
   */
  static writeHotelsCSV(hotels: Map<number, any>, outputPath: string): void {
    const csvLines = ['id,category,destination_code,chain_code,accommodation_type,ranking,group_hotel,country_code,state_code,longitude,latitude,name'];

    for (const hotel of hotels.values()) {
      const line = [
        hotel.id,
        hotel.category || '',
        hotel.destination_code || '',
        hotel.chain_code || '',
        hotel.accommodation_type || '',
        hotel.ranking || '',
        hotel.group_hotel || '',
        hotel.country_code || '',
        hotel.state_code || '',
        hotel.longitude || '',
        hotel.latitude || '',
        `"${(hotel.name || '').replace(/"/g, '""')}"`
      ].join(',');
      csvLines.push(line);
    }

    fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf8');
    Logger.info(`[GHOT] Wrote ${hotels.size} hotels to ${outputPath}`);
  }
}
