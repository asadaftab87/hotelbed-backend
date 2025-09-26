import fs from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";

export async function generateCSV(table: string, rows: any[]) {
  if (!rows.length) return;

  const csvDir = path.join(__dirname, "../../csv");
  await fs.promises.mkdir(csvDir, { recursive: true });

  const csvPath = path.join(csvDir, `${table}.csv`);
  const header = Object.keys(rows[0]);

  const csv = stringify(rows, { header: !fs.existsSync(csvPath), columns: header });
  await fs.promises.appendFile(csvPath, csv);
}
