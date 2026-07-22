abstract class AggregateRoot<T extends EntityId> {

    readonly id: T;

    protected constructor(id: T) {
        this.id = id;
    }

}