import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
import { PrismaService } from 'src/prisma.service';
import { FirebaseStorageService } from 'src/firebase/firebase-storage.service';
import { PubSubModule } from 'src/pubsub/pubsub.module';

@Module({
  imports: [PubSubModule],
  providers: [ChatResolver, ChatService, PrismaService, FirebaseStorageService],
})
export class ChatModule {}
