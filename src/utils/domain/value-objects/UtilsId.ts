import { EntityId } from "@shared";

class UtilsId extends EntityId{
    constructor(value: string){
        super(value);
    }

    static create(): UtilsId{
        return new UtilsId(crypto.randomUUID());
    }

    static fromString(value: string): UtilsId{
        return new UtilsId(value);
    }
}
export{ UtilsId }
