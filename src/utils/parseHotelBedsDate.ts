export function parseHotelBedsDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;

  let isoDate: string | null = null;

  // Agar YYYY-MM-DD format me hai
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    isoDate = dateStr;
  }

  // Agar YYYYMMDD format me hai
  else if (/^\d{8}$/.test(dateStr)) {
    isoDate = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
  }

  if (!isoDate) return null;

  // Prisma DateTime ke liye full ISO string
  return new Date(isoDate).toISOString(); // "2025-09-22T00:00:00.000Z"
}
