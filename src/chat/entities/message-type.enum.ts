import { registerEnumType } from '@nestjs/graphql';

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
  VOICE = 'VOICE',
}

registerEnumType(MessageType, {
  name: 'MessageType',
});
