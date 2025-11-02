import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import Logger from '@/core/Logger';

export class S3Uploader {
  private s3: AWS.S3;
  private bucket: string;
  private prefix: string;

  constructor(bucket: string, prefix: string = 'hotelbed-import') {
    this.bucket = bucket;
    this.prefix = prefix;

    // Initialize S3 client
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  /**
   * Upload single file to S3
   */
  async uploadFile(filePath: string, key?: string): Promise<string> {
    const fileName = key || path.basename(filePath);
    const s3Key = `${this.prefix}/${fileName}`;

    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    Logger.info(`[S3] Uploading ${fileName} (${fileSizeMB} MB) to S3...`);

    try {
      const uploadResult = await this.s3
        .upload({
          Bucket: this.bucket,
          Key: s3Key,
          Body: fileStream,
          ContentType: 'text/csv',
        })
        .promise();

      Logger.info(`[S3] Successfully uploaded ${fileName} to ${uploadResult.Location}`);
      return uploadResult.Location;
    } catch (error: any) {
      Logger.error(`[S3] Failed to upload ${fileName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Upload multiple files in parallel
   */
  async uploadFiles(filePaths: string[]): Promise<Record<string, string>> {
    Logger.info(`[S3] Starting parallel upload of ${filePaths.length} files...`);

    const uploadPromises = filePaths.map(async (filePath) => {
      const fileName = path.basename(filePath);
      try {
        const location = await this.uploadFile(filePath);
        return { fileName, location, success: true };
      } catch (error: any) {
        return { fileName, error: error.message, success: false };
      }
    });

    const results = await Promise.all(uploadPromises);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    Logger.info(`[S3] Upload complete: ${successful.length} successful, ${failed.length} failed`);

    if (failed.length > 0) {
      Logger.warn(`[S3] Failed uploads:`, failed);
    }

    // Return map of fileName -> S3 location
    const locationMap: Record<string, string> = {};
    successful.forEach(result => {
      locationMap[result.fileName] = result.location!;
    });

    return locationMap;
  }

  /**
   * Upload directory of CSV files
   */
  async uploadDirectory(directoryPath: string): Promise<Record<string, string>> {
    const files = fs
      .readdirSync(directoryPath)
      .filter(f => f.endsWith('.csv'))
      .map(f => path.join(directoryPath, f));

    if (files.length === 0) {
      throw new Error(`No CSV files found in ${directoryPath}`);
    }

    Logger.info(`[S3] Found ${files.length} CSV files to upload`);
    return await this.uploadFiles(files);
  }

  /**
   * Get S3 URL for a file
   */
  getS3Url(fileName: string): string {
    return `s3://${this.bucket}/${this.prefix}/${fileName}`;
  }

  /**
   * Check if S3 bucket is accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise();
      Logger.info(`[S3] Successfully connected to bucket: ${this.bucket}`);
      return true;
    } catch (error: any) {
      Logger.error(`[S3] Failed to access bucket: ${this.bucket}`, { error: error.message });
      return false;
    }
  }

  /**
   * Delete files from S3 (cleanup)
   */
  async deleteFiles(fileNames: string[]): Promise<void> {
    const objects = fileNames.map(fileName => ({
      Key: `${this.prefix}/${fileName}`,
    }));

    try {
      await this.s3
        .deleteObjects({
          Bucket: this.bucket,
          Delete: {
            Objects: objects,
          },
        })
        .promise();

      Logger.info(`[S3] Deleted ${fileNames.length} files from S3`);
    } catch (error: any) {
      Logger.error(`[S3] Failed to delete files`, { error: error.message });
      throw error;
    }
  }
}

