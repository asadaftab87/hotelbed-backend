import { parseHotelBedsDate } from "./parseHotelBedsDate";

export function normalizeRow(row: Record<string, any>) {
  const dateFields = ["startDate","endDate","validFrom","validTo"];
  const numericFields = ["netPrice","publicPrice","marketPrice","amount","amountSupplement","percentageSupplement","daysBeforeCheckin"];

  // Dates
  for (const f of dateFields) {
    if (row[f]) row[f] = parseHotelBedsDate(row[f]);
  }

  // Numbers
  for (const f of numericFields) {
    if (row[f] != null) row[f] = parseFloat(row[f]) || 0;
  }

  return row;
}
