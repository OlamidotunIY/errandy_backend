<<<<<<< HEAD
import { EntityId } from '@shared';

class WalletId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): WalletId {
    return new WalletId(crypto.randomUUID());
  }

  static fromString(value: string): WalletId {
    return new WalletId(value);
  }
}

export { WalletId };
=======
import { EntityId } from "@shared";

class WalletId extends EntityId{
    constructor(value: string){
        super(value);
    }

    static create(): WalletId{
        return new WalletId(crypto.randomUUID());
    }

    static fromString(value: string){
        return new WalletId(value)
    }
}
export { WalletId }
>>>>>>> 148be1c (feat: update ID fields to use UUIDs and create value object classes for various entities)
