import { registerEnumType } from '@nestjs/graphql';

export enum ApplicationSource {
  PUBLIC = 'PUBLIC',
  INVITED = 'INVITED',
}

registerEnumType(ApplicationSource, {
  name: 'ApplicationSource',
});
