import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
import { PrismaService } from 'src/prisma.service';
import { FirebaseStorageService } from 'src/firebase/firebase-storage.service';

@Module({
  providers: [ChatResolver, ChatService, PrismaService, FirebaseStorageService],
})
export class ChatModule {}
