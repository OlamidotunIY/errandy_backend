import { EntityId } from "@shared";

class DisputeId extends EntityId{
    constructor(value: string){
        super(value);
    }

    static create(): DisputeId{
        return new DisputeId(crypto.randomUUID());
    }

    static fromString(value: string){
        return new DisputeId(value)
    }
}
export { DisputeId } 
