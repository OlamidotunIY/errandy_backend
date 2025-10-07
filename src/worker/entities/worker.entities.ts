import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from 'src/users/entities/user.entity';
import { Search } from 'src/users/entities/search-history.entities';
// import { ServicesOnWorkers } from 'src/services/entities/services-on-workers.entity';
// import { Wallet } from 'src/wallet/entities/wallet.entity';

@ObjectType()
export class Worker {
	@Field(() => ID)
	id: string;

	@Field({ nullable: true })
	workerType?: string;

	@Field(() => ID)
	userId: string;

	@Field(() => User)
	user: User;

	@Field(() => [Search], { nullable: 'itemsAndList' })
	searchHistory?: Search[];

	// @Field(() => [ServicesOnWorkers], { nullable: 'itemsAndList' })
	// services?: ServicesOnWorkers[];

	// @Field(() => Wallet, { nullable: true })
	// wallet?: Wallet;
}
