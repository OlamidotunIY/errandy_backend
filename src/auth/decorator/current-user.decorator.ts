import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const user =
      gqlContext?.req?.user ?? gqlContext?.user ?? gqlContext?.extra?.user;

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return user; // Set in GqlAuthGuard or ws onConnect
  },
);
