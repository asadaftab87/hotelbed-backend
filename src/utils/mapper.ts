import { sectionMappers } from "./hotelbed.mapping";
import { parseHotelBedsDate } from "./parseHotelBedsDate";

const BOOLEAN_FIELDS = [
  "noHotelFlag", "dailyPriceFlag", "releaseDaysFlag", "opaqueFlag", "fixRateFlag",
  "sellingPriceFlag", "activeFlag", "checkInFlag", "checkOutFlag", "stopSalesFlag",
  "perPaxFlag", "monFlag", "tueFlag", "wedFlag", "thuFlag", "friFlag", "satFlag", "sunFlag"
];

const INT_FIELDS = [
  "releaseDays", "allotment", "minChildAge", "maxChildAge", "maxRooms", "minAdults",
  "minChildren", "maxAdults", "maxChildren", "maxInfants", "daysBeforeCheckin",
  "standardCapacity", "minPax", "maxPax", "maxAdults", "maxChildren", "maxInfants",
  "minAdults", "minChildren"
];

const FLOAT_FIELDS_NULLABLE = [
  "genericRate", "specificRate", "amount", "netPrice", "publicPrice",
  "marketPrice", "amountSupplement", "percentageSupplement", "percentage"
];

export function mapRow(section: string, rows: Record<string, any>[]) {
  const mapper = sectionMappers[section];
  if (!mapper) return rows;

  return rows.map(row => {
    const mapped: Record<string, any> = {};

    mapper.forEach((fieldName, idx) => {
      let value = row[`field_${idx}`];

      // Date
      if (fieldName.toLowerCase().includes("date")) {
        value = parseHotelBedsDate(value) ?? null;
      }

      // Boolean
      if (BOOLEAN_FIELDS.includes(fieldName)) {
        value = value === "Y";
      }

      // Int
      if (INT_FIELDS.includes(fieldName)) {
        value = value ? parseInt(value) : null;
      }

      // Float
      if (FLOAT_FIELDS_NULLABLE.includes(fieldName)) {
        value = value ? parseFloat(value) : null;
      }

      mapped[fieldName] = value;
    });

    return mapped;
  });
}
