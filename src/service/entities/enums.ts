import { registerEnumType } from "@nestjs/graphql";

export enum GqlServiceCategoryType {
  CASUAL = 'CASUAL',
  PROFESSIONAL = 'PROFESSIONAL',
  ARTISAN = 'ARTISAN',
}

registerEnumType(GqlServiceCategoryType, {
  name: 'ServiceCategoryType',
});