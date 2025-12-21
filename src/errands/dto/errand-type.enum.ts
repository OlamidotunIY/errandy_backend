import { registerEnumType } from '@nestjs/graphql';

export enum ErrandType {
  FEED = 'feed',
  BEST_MATCH = 'best_match',
  MOST_RECENT = 'most_recent',
  SAVED = 'saved',
  SEARCH = 'search',
}

registerEnumType(ErrandType, {
  name: 'ErrandType',
  description: 'Type of errand feed to retrieve',
});
