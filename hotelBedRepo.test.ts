// hotelBedRepo.test.ts
import path from "path";
import AdmZip from "adm-zip";
import fs from "fs";

// 👇 mock pool aur bulkInsertRaw
jest.mock("./src/database/index", () => ({
  pool: { query: jest.fn().mockResolvedValue([{ insertId: 1 }]) }
}));
jest.mock("./src/utils/bulkInsertRaw", () => ({
  bulkInsertRaw: jest.fn().mockResolvedValue(undefined)
}));
// Mock ESM packages so Jest doesn't try to parse them
jest.mock("ora", () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
  }));
});

jest.mock("progress", () => {
  return jest.fn().mockImplementation(() => ({
    tick: jest.fn(),
  }));
});

import HotelBedFileRepo from "./src/Api/Components/hotelBed/hotelBed.repository";

function createDummyZip() {
  let dummyData = "";
  for (let i = 1; i <= 10; i++) {
    dummyData += `
{CCON}
${i}:NYC:OFC${i}:C00${i}:Summer Contract ${i}:COMP${i}:HTL:100${i}:2000${i}:2024-01-01:2024-12-31:USD:BB:STD:PREPAID
{/CCON}
`;
  }

  const downloadsDir = path.join(__dirname, "./downloads");
  const zipPath = path.join(downloadsDir, "hotelbeds_dummy.zip");
  const extractPath = path.join(downloadsDir, "hotelbeds_dummy");

  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const zip = new AdmZip();
  zip.addFile("sample.txt", Buffer.from(dummyData));
  zip.writeZip(zipPath);

  return { zipPath, extractPath };
}

describe("HotelBedFileRepo Dummy Test", () => {
  it("should process dummy zip with 10 records without saving to DB", async () => {
    const { zipPath, extractPath } = createDummyZip();

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    const repo: any = HotelBedFileRepo;
    const result = await repo.processDir(extractPath, "full");

    // Assertions
    expect(result).toBeUndefined();
  });
});
