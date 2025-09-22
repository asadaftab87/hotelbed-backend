import { convertFromDirectory } from 'joi-to-typescript';
import fs from 'fs';

async function createDynamicPayloadInterface(): Promise<void> {
  fs.rmSync('./src/Interface/payloadInterface', { force: true, recursive: true })
  // console.log("Running joi-to-typescript...");

  // Configure your settings here
  const result = await convertFromDirectory({
    schemaDirectory: './src/validations/payloadSchema',
    typeOutputDirectory: './src/Interface/payloadInterface',
    debug: true
  });

  if (result) {
    console.log("Completed joi-to-typescript--------------------------------------------------");
  } else {
    console.log("Failed to run joi-to-typescrip--------------------------------------------------");
  }
}

createDynamicPayloadInterface();
