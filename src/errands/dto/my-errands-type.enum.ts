import { registerEnumType } from '@nestjs/graphql';

/**
 * Type of errands to retrieve for "My Errands" view
 * - Client tabs: ACTIVE, PUBLISHED, DRAFT (errands they created)
 * - Provider tabs: ACTIVE, PENDING, REJECTED, COMPLETED (errands they applied for)
 */
export enum MyErrandsType {
  // Client tabs - errands they created
  CLIENT_ACTIVE = 'client_active', // OPEN + IN_PROGRESS
  CLIENT_PUBLISHED = 'client_published', // OPEN only
  CLIENT_DRAFT = 'client_draft', // DRAFT

  // Provider tabs - errands they applied for
  PROVIDER_ACTIVE = 'provider_active', // Accepted applications with IN_PROGRESS errands
  PROVIDER_PENDING = 'provider_pending', // PENDING applications
  PROVIDER_REJECTED = 'provider_rejected', // REJECTED/CANCELLED applications
  PROVIDER_COMPLETED = 'provider_completed', // COMPLETED errands
}

registerEnumType(MyErrandsType, {
  name: 'MyErrandsType',
  description: 'Type of errands to retrieve for My Errands view',
});
