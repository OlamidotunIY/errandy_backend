import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { User, GqlUserRole } from 'src/users/entities/user.entity';
@InputType()
export class RegisterDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Field()
  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string;

  @Field()
  username: string;

  @Field(() => GqlUserRole, { nullable: true })
  role?: GqlUserRole;
}

@ObjectType()
export class AuthResponse {
  @Field(() => String, { nullable: true })
  token: string | null;

  @Field(() => User, { nullable: true })
  user: User | null;
}
