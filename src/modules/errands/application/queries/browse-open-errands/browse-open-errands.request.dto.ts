export interface BrowseOpenErrandsRequestDto {
  requesterPartyId: string;
  categoryId?: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit: number;
  cursor?: string;
}

export interface ErrandSummaryResponseDto {
  id: string;
  title: string;
  categoryId: string;
  budget: { amountMinorUnits: number; currency: string };
  distanceMeters: number;
  createdAt: string;
}

export interface BrowseOpenErrandsResponseDto {
  items: ErrandSummaryResponseDto[];
}
