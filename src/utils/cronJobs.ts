import cron from "node-cron";
import Logger from "../core/Logger";
import HotelBedFileRepo from "../Api/Components/hotelBed/hotelBed.repository";
export class CronJob {
  constructor() {
    this.scheduleCronJob();
  }

  private scheduleCronJob() {
    cron.schedule("0 3 * * *", async () => {
      Logger.info("[HotelBeds] Starting FULL feed cron job...");
      try {
        await HotelBedFileRepo.createFromZip("full");
        Logger.info("[HotelBeds] FULL feed finished ✅");
      } catch (err: any) {
        Logger.error("[HotelBeds] FULL feed failed ❌: " + err.message);
      }
    });

    cron.schedule("0 * * * *", async () => {
      Logger.info("[HotelBeds] Starting UPDATE feed cron job...");
      try {
        await HotelBedFileRepo.createFromZip("update");
        Logger.info("[HotelBeds] UPDATE feed finished ✅");
      } catch (err: any) {
        Logger.error("[HotelBeds] UPDATE feed failed ❌: " + err.message);
      }
    });
  }
}
