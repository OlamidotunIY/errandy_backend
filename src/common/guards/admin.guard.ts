import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;

    if (!req?.user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
