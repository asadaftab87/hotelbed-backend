import cron from "node-cron";
import Logger from "../core/Logger";
import HotelBedFileRepo from "../Api/Components/hotelBed/hotelBed.repository";

export class CronJob {
  private isFullRunning = false;
  private isUpdateRunning = false;

  constructor() {
    this.scheduleCronJob();
  }

  private scheduleCronJob() {
    // FULL feed cron (daily 3 AM)
    cron.schedule("0 3 * * *", async () => {
      if (this.isFullRunning) {
        Logger.warn("[HotelBeds] FULL feed is already running, skipping...");
        return;
      }

      this.isFullRunning = true;
      Logger.info("[HotelBeds] Starting FULL feed cron job...");
      try {
        await HotelBedFileRepo.createFromZip("full");
        Logger.info("[HotelBeds] FULL feed finished ✅");
      } catch (err: any) {
        Logger.error("[HotelBeds] FULL feed failed ❌: " + err.message);
      } finally {
        this.isFullRunning = false;
      }
    });

    // UPDATE feed cron (hourly)
    cron.schedule("0 * * * *", async () => {
      if (this.isFullRunning) {
        Logger.warn("[HotelBeds] Skipping UPDATE feed because FULL feed is running 🚫");
        return;
      }

      if (this.isUpdateRunning) {
        Logger.warn("[HotelBeds] UPDATE feed is already running, skipping...");
        return;
      }

      this.isUpdateRunning = true;
      Logger.info("[HotelBeds] Starting UPDATE feed cron job...");
      try {
        await HotelBedFileRepo.createFromZip("update");
        Logger.info("[HotelBeds] UPDATE feed finished ✅");
      } catch (err: any) {
        Logger.error("[HotelBeds] UPDATE feed failed ❌: " + err.message);
      } finally {
        this.isUpdateRunning = false;
      }
    });
  }
}
