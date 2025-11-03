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

  /**
   * Clean entire S3 bucket prefix (delete all files with this prefix)
   */
  async cleanBucket(): Promise<void> {
    try {
      Logger.info(`[S3] Cleaning bucket prefix: ${this.prefix}/`);

      let continuationToken: string | undefined;
      let totalDeleted = 0;

      do {
        // List all objects with the prefix
        const listParams: AWS.S3.ListObjectsV2Request = {
          Bucket: this.bucket,
          Prefix: `${this.prefix}/`,
        };

        if (continuationToken) {
          listParams.ContinuationToken = continuationToken;
        }

        const listResult = await this.s3.listObjectsV2(listParams).promise();

        if (listResult.Contents && listResult.Contents.length > 0) {
          // Delete objects in batches of 1000 (S3 limit)
          const objects = listResult.Contents.map(obj => ({ Key: obj.Key! }));
          
          const deleteParams: AWS.S3.DeleteObjectsRequest = {
            Bucket: this.bucket,
            Delete: {
              Objects: objects,
            },
          };

          const deleteResult = await this.s3.deleteObjects(deleteParams).promise();
          totalDeleted += deleteResult.Deleted?.length || 0;

          Logger.info(`[S3] Deleted ${deleteResult.Deleted?.length || 0} files (total: ${totalDeleted})`);
        }

        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);

      Logger.info(`[S3] Bucket cleanup complete: ${totalDeleted} files deleted`);
    } catch (error: any) {
      Logger.error(`[S3] Failed to clean bucket`, { error: error.message });
      throw error;
    }
  }
}

