import { registerEnumType } from "@nestjs/graphql";

export enum GqlServiceCategoryType {
  CASUAL = 'CASUAL',
  PROFESSIONAL = 'PROFESSIONAL',
}

registerEnumType(GqlServiceCategoryType, {
  name: 'ServiceCategoryType',
});