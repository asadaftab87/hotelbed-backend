import path from 'path';
import Logger from '@/core/Logger';
import { spawn } from 'child_process';

export interface CSVImportResult {
  success: boolean;
  tables: Record<string, unknown>;
  error?: string;
}

export interface CSVImportOptions {
  csvDir: string;
}

export async function runImportAllCSVs(options: CSVImportOptions): Promise<CSVImportResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../import-all-csvs.js');
    
    Logger.info('[CSV IMPORT] Running import script', { csvDir: options.csvDir });
    
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env, CSV_DIR: options.csvDir },
      stdio: 'inherit'
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, tables: {} });
      } else {
        reject(new Error(`Import failed with code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      Logger.error('[CSV IMPORT] Failed', { error: err.message });
      reject(err);
    });
  });
}
