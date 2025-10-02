import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function buildInventory(hotelBedFileId: number) {
  // 1. Get Restrictions
  const restrictions = await prisma.restriction.findMany({
    where: { hotelBedId: hotelBedFileId }
  });

  for (const r of restrictions) {
    const start = r.startDate!;
    const end = r.endDate!;
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= days; i++) {
      const calendarDate = new Date(start);
      calendarDate.setDate(start.getDate() + i);

      // 2. Check stopSale
      const stopSale = await prisma.stopSale.findFirst({
        where: {
          hotelBedId: hotelBedFileId,
          roomCode: r.roomCode,
          startDate: { lte: calendarDate },
          endDate: { gte: calendarDate },
          stopSalesFlag: true
        }
      });

      // 3. Check Min/Max stay
      const minMax = await prisma.minMaxStay.findFirst({
        where: {
          hotelBedId: hotelBedFileId,
          roomCode: r.roomCode,
          startDate: { lte: calendarDate },
          endDate: { gte: calendarDate }
        }
      });

      let minNights = null, maxNights = null;
      if (minMax?.daysRules) {
        const parts = minMax.daysRules.split("-");
        minNights = parseInt(parts[0], 10);
        maxNights = parseInt(parts[1], 10);
      }

      // 4. Check price
      const cost = await prisma.cost.findFirst({
        where: {
          hotelBedId: hotelBedFileId,
          roomCode: r.roomCode,
          startDate: { lte: calendarDate },
          endDate: { gte: calendarDate }
        }
      });

      // 5. Insert into Inventory table
      await prisma.inventory.upsert({
        where: {
          hotelBedId_calendarDate_roomCode_rateCode: {
            hotelBedId: hotelBedFileId,
            calendarDate,
            roomCode: r.roomCode ?? "",
            rateCode: r.rateCode ?? ""
          }
        },
        update: {
          allotment: r.allotment,
          stopSale: !!stopSale,
          releaseDays: r.releaseDays,
          minNights,
          maxNights,
          netPrice: cost?.netPrice ?? null,
          publicPrice: cost?.publicPrice ?? null
        },
        create: {
          hotelBedId: hotelBedFileId,
          calendarDate,
          roomCode: r.roomCode,
          rateCode: r.rateCode,
          allotment: r.allotment,
          stopSale: !!stopSale,
          releaseDays: r.releaseDays,
          minNights,
          maxNights,
          netPrice: cost?.netPrice ?? null,
          publicPrice: cost?.publicPrice ?? null,
          currency: "EUR" // ya jo bhi tumhe chahiye
        }
      });
    }
  }
}
