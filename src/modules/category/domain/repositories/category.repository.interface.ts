import { Category } from '../entities';

export abstract class ICategoryRepository {
  abstract save(category: Category): Promise<void>;
  abstract findById(id: string): Promise<Category | null>;
  abstract findChildren(parentCategoryId: string): Promise<Category[]>;
  abstract findRoots(): Promise<Category[]>;
  abstract findLeaves(): Promise<Category[]>;
}
