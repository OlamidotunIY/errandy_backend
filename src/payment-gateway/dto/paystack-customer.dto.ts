import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, IsPhoneNumber } from 'class-validator';

@InputType()
export class CreatePaystackCustomerInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  lastName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;
}

@InputType()
export class UpdatePaystackCustomerInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  lastName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;
}
