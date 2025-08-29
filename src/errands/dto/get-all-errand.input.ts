import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class GetAllErrandInput {
  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true, defaultValue: 5 }) // ✅ default is 5
  maxDistanceKm: number;
}
