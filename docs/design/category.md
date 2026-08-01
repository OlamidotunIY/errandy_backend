# Module: category

Small, shared reference module — used by both `errands` (`Errand.categoryId`) and `service` (`Service.categoryId`). Seed-managed for now, no admin CRUD surface yet (same as `Market`).

## Folder placement

```
src/modules/category/
├── domain/
│   ├── entities/
│   │   └── category.entity.ts
│   ├── repositories/
│   │   └── category.repository.interface.ts
│   └── errors/
│       ├── category-not-found.error.ts
│       └── category-not-leaf.error.ts
├── application/
│   └── queries/
│       └── list-category-tree/
├── infrastructure/
│   ├── mappers/
│   │   └── category.mapper.ts
│   └── repositories/
│       └── category.repository.ts
└── category.module.ts
```

## Prisma schema

Self-relation — legitimate within this one module/aggregate, same rule as everywhere else (cross-module references must be plain scalars, this is neither).

```prisma
model Category {
  id               String     @id @default(auto()) @map("_id") @db.ObjectId
  name             String
  parentCategoryId String?    @db.ObjectId
  parent           Category?  @relation("CategoryChildren", fields: [parentCategoryId], references: [id])
  children         Category[] @relation("CategoryChildren")
  requiredTier     String?    // ProviderTier — only set on leaf categories (no children); parents are browsing-only groupings
}
```

## Domain entity methods

**`Category`**
- `isLeaf()` — true if it has no children (used to validate assignability — only leaves can be set on `Errand.categoryId`/`Service.categoryId`)

Otherwise intentionally thin — this is a supporting/reference subdomain, not core, so no rich behavior beyond the leaf check.

## Repository interface

```typescript
abstract class ICategoryRepository {
  abstract save(category: Category): Promise<void>;
  abstract findById(id: string): Promise<Category | null>;
  abstract findChildren(parentCategoryId: string): Promise<Category[]>;
  abstract findRoots(): Promise<Category[]>;
  abstract findLeaves(): Promise<Category[]>;
}
```

## DTOs

```typescript
// queries/list-category-tree/list-category-tree.response.dto.ts
interface CategoryTreeNodeResponseDto {
  id: string;
  name: string;
  requiredTier: 'COMMUNITY' | 'VERIFIED' | 'CERTIFIED' | null;
  children: CategoryTreeNodeResponseDto[];   // recursive — empty array for leaves
}
// ListCategoryTreeQuery returns CategoryTreeNodeResponseDto[] (the roots, each with nested children)
```

## Open items

None — deliberately minimal.
