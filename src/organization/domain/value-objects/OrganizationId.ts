import { EntityId } from "@shared";

class OrganizationId extends EntityId{
    constructor(value: string){
        super(value);
    }

    static create(): OrganizationId{
        return new OrganizationId(crypto.randomUUID());
    }

    static fromString(value: string): OrganizationId{
        return new OrganizationId(value);
    }
}
export{ OrganizationId }
