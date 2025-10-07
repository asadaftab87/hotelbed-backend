// src/utils/mapper.ts
import { sectionMappers } from "./hotelbed.mapping";
import { parseHotelBedsDate } from "./parseHotelBedsDate";

function toMySQLDateString(value: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

const BOOLEAN_FIELDS = [
  "noHotel","dailyPrice","releaseDays","opaque","fixRate",
  "sellingPrice","activeFlag","checkInFlag","checkOutFlag","stopSalesFlag",
  "perPaxFlag","monFlag","tueFlag","wedFlag","thuFlag","friFlag","satFlag","sunFlag",
  "mandatoryFlag","includedFlag","perDateFlag","isIncluded","validForCountry",
  "isPerService","includedInPrice","isPerNight","isPerPax","stopSale"
];

const INT_FIELDS = [
  "allotment","minChildAge","maxChildAge","maxRooms","minAdults",
  "minChildren","maxAdults","maxChildren","maxInfants","daysBeforeCheckin",
  "standardCapacity","minPax","maxPax","minimumAge","maximumAge",
  "maximumNumberOfNights","cta","ctd","minNights","maxNights"
];

const FLOAT_FIELDS_NULLABLE = [
  "genericRate","specificRate","amount","netPrice","publicPrice",
  "marketPrice","amountSupplement","percentageSupplement","percentage",
  "adultAmount","childAmount","ageAmount"
];

export function mapRow(section: string, rows: Record<string, any>[]) {
  const mapper = sectionMappers[section];
  if (!mapper) return rows;

  return rows.map(row => {
    const mapped: Record<string, any> = {};

    mapper.forEach((fieldName, idx) => {
      let value = row[`field_${idx}`];

      // Date fields -> MySQL datetime string
      if (fieldName.toLowerCase().includes("date") || fieldName.toLowerCase().includes("from") || fieldName.toLowerCase().includes("to")) {
        const parsed = parseHotelBedsDate(value);
        value = parsed ? toMySQLDateString(parsed) : null;
      }

      // Boolean
      else if (BOOLEAN_FIELDS.includes(fieldName)) {
        // sometimes fields may be "Y"/"N" or "1"/"0"
        if (value === "Y" || value === "1" || value === 1 || value === true) value = true;
        else if (value === "N" || value === "0" || value === 0 || value === false) value = false;
        else value = null;
      }

      // Integer (safe)
      else if (INT_FIELDS.includes(fieldName)) {
        const num = parseInt(value as any, 10);
        value = Number.isNaN(num) ? null : num;
      }

      // Float (safe)
      else if (FLOAT_FIELDS_NULLABLE.includes(fieldName)) {
        const num = parseFloat(value as any);
        value = Number.isNaN(num) ? null : num;
      }

      // else keep value or convert empty -> null
      else {
        value = value === undefined || value === "" ? null : value;
      }

      mapped[fieldName] = value;
    });

    return mapped;
  });
}
