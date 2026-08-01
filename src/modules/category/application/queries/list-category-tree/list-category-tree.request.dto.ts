export interface ListCategoryTreeRequestDto {
  rootId?: string;
}

export interface CategoryTreeNodeResponseDto {
  id: string;
  name: string;
  requiredTier: 'COMMUNITY' | 'VERIFIED' | 'CERTIFIED' | null;
  children: CategoryTreeNodeResponseDto[];
}
