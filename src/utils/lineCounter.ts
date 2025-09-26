// src/utils/lineCounter.ts
import fs from "fs";
import readline from "readline";

export async function countLines(filePath: string): Promise<number> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });
  let count = 0;
  for await (const _ of rl) {
    count++;
  }
  return count;
}
