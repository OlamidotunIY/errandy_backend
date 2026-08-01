import { AggregateRoot } from '@src/common';
import { ProviderTier } from '@module/party';
import { CategoryId } from '../value-objects';

const TIER_RANK: Record<ProviderTier, number> = {
  [ProviderTier.COMMUNITY]: 0,
  [ProviderTier.VERIFIED]: 1,
  [ProviderTier.CERTIFIED]: 2,
};

interface CategoryProps {
  id: CategoryId;
  name: string;
  parentCategoryId: CategoryId | null;
  childrenIds: CategoryId[];
  requiredTier: ProviderTier | null;
}

export class Category extends AggregateRoot<CategoryId> {
  private _name: string;
  private _parentCategoryId: CategoryId | null;
  private _childrenIds: CategoryId[];
  private _requiredTier: ProviderTier | null;

  private constructor(props: CategoryProps) {
    super(props.id);
    this._name = props.name;
    this._parentCategoryId = props.parentCategoryId;
    this._childrenIds = props.childrenIds;
    this._requiredTier = props.requiredTier;
  }

  static reconstitute(props: CategoryProps): Category {
    return new Category(props);
  }

  get name(): string {
    return this._name;
  }

  get parentCategoryId(): CategoryId | null {
    return this._parentCategoryId;
  }

  get childrenIds(): CategoryId[] {
    return this._childrenIds;
  }

  get requiredTier(): ProviderTier | null {
    return this._requiredTier;
  }

  isLeaf(): boolean {
    return this._childrenIds.length === 0;
  }

  meetsRequiredTier(tier: ProviderTier): boolean {
    if (!this._requiredTier) {
      return true;
    }
    return TIER_RANK[tier] >= TIER_RANK[this._requiredTier];
  }
}
