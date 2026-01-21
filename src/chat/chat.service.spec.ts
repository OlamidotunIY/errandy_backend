import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from 'src/prisma.service';
import { FirebaseStorageService } from 'src/firebase/firebase-storage.service';
import { PubSubService } from 'src/pubsub';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: {} },
        { provide: FirebaseStorageService, useValue: {} },
        { provide: PubSubService, useValue: {} },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
