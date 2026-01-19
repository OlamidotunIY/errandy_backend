import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Readable } from 'stream';
import { FirebaseAdminService } from './firebase-admin.service';

export interface FirebaseUploadOptions {
  stream: Readable;
  destination: string;
  contentType?: string;
  makePublic?: boolean;
  metadata?: Record<string, string>;
  cacheControl?: string;
  signedUrlExpiresInMs?: number;
}

export interface FirebaseUploadResult {
  bucket: string;
  path: string;
  url: string;
}

@Injectable()
export class FirebaseStorageService {
  constructor(
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly configService: ConfigService,
  ) {}

  async uploadStream(options: FirebaseUploadOptions): Promise<FirebaseUploadResult> {
    const bucket = this.getBucket();
    const file = bucket.file(options.destination);

    await new Promise<void>((resolve, reject) => {
      const writeStream = file.createWriteStream({
        resumable: false,
        metadata: {
          contentType: options.contentType,
          cacheControl: options.cacheControl,
          metadata: options.metadata,
        },
      });

      options.stream
        .on('error', reject)
        .pipe(writeStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    if (options.makePublic) {
      await file.makePublic();
      return {
        bucket: bucket.name,
        path: options.destination,
        url: file.publicUrl(),
      };
    }

    const expiresInMs = options.signedUrlExpiresInMs ?? 1000 * 60 * 60;
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMs,
    });

    return {
      bucket: bucket.name,
      path: options.destination,
      url: signedUrl,
    };
  }

  async deleteFile(path: string) {
    const bucket = this.getBucket();
    await bucket.file(path).delete({ ignoreNotFound: true });
  }

  async getSignedUrl(path: string, expiresInMs = 1000 * 60 * 60) {
    const bucket = this.getBucket();
    const [signedUrl] = await bucket.file(path).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMs,
    });

    return signedUrl;
  }

  private getBucket() {
    if (!this.firebaseAdminService.isInitialized()) {
      this.firebaseAdminService.ensureInitialized();
    }

    if (!this.firebaseAdminService.isInitialized()) {
      throw new InternalServerErrorException(
        'Firebase is not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY.',
      );
    }

    const bucketName =
      this.configService.get<string>('FIREBASE_STORAGE_BUCKET');

    if (!bucketName) {
      throw new InternalServerErrorException(
        'FIREBASE_STORAGE_BUCKET is not configured.',
      );
    }

    return admin.storage().bucket(bucketName);
  }
}
