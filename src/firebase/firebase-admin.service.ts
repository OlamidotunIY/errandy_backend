import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.ensureInitialized();
  }

  ensureInitialized() {
    if (admin.apps.length > 0) {
      return admin.app();
    }

    const serviceAccountPath = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_KEY',
    );

    if (!serviceAccountPath) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_KEY not configured - Firebase disabled',
      );
      return null;
    }

    const fullPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(process.cwd(), serviceAccountPath);

    if (!fs.existsSync(fullPath)) {
      this.logger.error(`Firebase service account file not found: ${fullPath}`);
      return null;
    }

    try {
      const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const storageBucket = this.configService.get<string>(
        'FIREBASE_STORAGE_BUCKET',
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        ...(storageBucket ? { storageBucket } : {}),
      });

      this.logger.log('Firebase Admin initialized successfully');
      return admin.app();
    } catch (error) {
      this.logger.error(
        `Failed to initialize Firebase Admin: ${error.message}`,
      );
      return null;
    }
  }

  isInitialized() {
    return admin.apps.length > 0;
  }
}
