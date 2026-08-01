import {
  BadgeType,
  OrgMemberRole,
  PartyKind,
  ProviderTier,
} from '@module/party';
import { registerEnumType } from '@nestjs/graphql';

registerEnumType(PartyKind, { name: 'PartyKind' });
registerEnumType(ProviderTier, { name: 'ProviderTier' });
registerEnumType(OrgMemberRole, { name: 'OrgMemberRole' });
registerEnumType(BadgeType, { name: 'BadgeType' });
