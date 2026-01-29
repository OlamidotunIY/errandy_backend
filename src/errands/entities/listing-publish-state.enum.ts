import { registerEnumType } from '@nestjs/graphql';

export enum ListingPublishState {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

registerEnumType(ListingPublishState, {
  name: 'ListingPublishState',
});
