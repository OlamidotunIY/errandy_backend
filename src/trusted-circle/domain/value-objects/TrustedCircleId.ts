import { EntityId } from "@shared";

class TrustedCircleId extends EntityId{
    constructor(value: string){
        super(value);
    }

    static create(): TrustedCircleId{
        return new TrustedCircleId(crypto.randomUUID())
    };

    static fromString(value: string): TrustedCircleId{
        return new TrustedCircleId(value);
    }
}
export{ TrustedCircleId }
