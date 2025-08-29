import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { auth } from 'auth';

@Injectable()
export class GqlAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Convert to GraphQL context
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;

    // Convert req.headers to Fetch API Headers object
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers.append(key, value);
      } else if (Array.isArray(value)) {
        headers.append(key, value.join(','));
      }
    }

    // Get session from better-auth
    const session = await auth.api.getSession({
      headers,
      query: {
        disableCookieCache: true, // optional
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or missing session');
    }

    // Attach user/session to request for resolvers
    req.user = session.user;
    req.session = session;

    return true;
  }
}
