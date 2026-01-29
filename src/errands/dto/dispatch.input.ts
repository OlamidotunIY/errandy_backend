import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { AssignmentRole } from '../entities/errand-assignment.entity';

@InputType()
export class DispatchErrandInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  errandId: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  providerOrgId: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  workerId?: string;

  @Field(() => AssignmentRole, {
    nullable: true,
    defaultValue: AssignmentRole.MEMBER,
  })
  @IsEnum(AssignmentRole)
  @IsOptional()
  role?: AssignmentRole;
}
