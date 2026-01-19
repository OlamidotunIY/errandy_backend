import { Global, Module } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseStorageService } from './firebase-storage.service';

@Global()
@Module({
  providers: [FirebaseAdminService, FirebaseStorageService],
  exports: [FirebaseAdminService, FirebaseStorageService],
})
export class FirebaseModule {}
