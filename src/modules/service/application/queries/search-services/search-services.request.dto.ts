export interface SearchServicesRequestDto {
  categoryId?: string;
  marketId: string;
  limit: number;
  cursor?: string;
}
