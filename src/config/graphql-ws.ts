import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { auth } from 'auth';
import { join } from 'path';
import { PresenceModule } from 'src/presence/presence.module';
import { PresenceStatus } from 'src/presence/entities/presence.entity';
import { PresencePublisher } from 'src/presence/presence.publicher';
import { PresenceService } from 'src/presence/presence.service';
import type { Context } from 'graphql-ws';
import { v4 as uuid } from 'uuid';

type WsExtra = {
  userId?: string;
  connectionId?: string;
  user?: unknown;
  session?: unknown;
  headers?: Record<string, string>;
};

type WsContext = Context<Record<string, unknown> | undefined, WsExtra>;

export const GqlConfig = GraphQLModule.forRootAsync<ApolloDriverConfig>({
  imports: [ConfigModule, PresenceModule],
  inject: [ConfigService, PresenceService, PresencePublisher],
  driver: ApolloDriver,
  useFactory: async (
    configService: ConfigService,
    presenceService: PresenceService,
    presencePublisher: PresencePublisher,
  ) => {
    const isProduction = configService.get('NODE_ENV') === 'production';
    return {
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      autoSchemaFile: isProduction
        ? true
        : join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      context: (ctx) => {
        if ('req' in ctx && ctx.req) {
          return ctx;
        }

        const wsContext = ctx as WsContext;
        const req = {
          headers: wsContext.extra?.headers ?? {},
          user: wsContext.extra?.user,
          session: wsContext.extra?.session,
        };

        return {
          req,
          user: wsContext.extra?.user,
          session: wsContext.extra?.session,
          connectionParams: wsContext.connectionParams,
          extra: wsContext.extra,
        };
      },
      subscriptions: {
        'graphql-ws': {
          onConnect: async (ctx: WsContext) => {
            console.log('WS onConnect called', {
              hasConnectionParams: !!ctx.connectionParams,
              keys: ctx.connectionParams
                ? Object.keys(ctx.connectionParams)
                : [],
            });
            // graphql-ws provides connectionParams
            const headers = new Headers();

            const authorization =
              (ctx.connectionParams?.Authorization as string | undefined) ??
              (ctx.connectionParams?.authorization as string | undefined);

            if (authorization) {
              headers.set('authorization', authorization);
            }

            // If you also want cookie support:
            const cookie =
              (ctx.connectionParams?.Cookie as string | undefined) ??
              (ctx.connectionParams?.cookie as string | undefined);

            if (cookie) {
              headers.set('cookie', cookie);
            }

            ctx.extra.headers = {
              ...(authorization ? { authorization } : {}),
              ...(cookie ? { cookie } : {}),
            };

            const session = await auth.api.getSession({
              headers,
              query: { disableCookieCache: true },
            });

            if (!session?.user?.id) {
              throw new UnauthorizedException('Unauthorized');
            }

            const userId = session.user.id;
            const connectionId = uuid();

            // Persist into ctx.extra for disconnect handler
            ctx.extra.userId = userId;
            ctx.extra.connectionId = connectionId;
            ctx.extra.user = session.user;
            ctx.extra.session = session;

            const wasOnline = await presenceService.isOnline(userId);
            await presenceService.addConnection(userId, connectionId);

            if (!wasOnline) {
              await presencePublisher.publish(userId, PresenceStatus.ONLINE);
            }

            // This becomes available in subscription resolvers context if needed
            return {
              req: {
                user: session.user,
                session,
              },
              user: session.user,
              session,
            };
          },
          onDisconnect: async (ctx: WsContext) => {
            const userId = ctx.extra?.userId as string | undefined;
            const connectionId = ctx.extra?.connectionId as string | undefined;

            if (!userId || !connectionId) return;

            const stillOnline = await presenceService.removeConnection(
              userId,
              connectionId,
            );

            if (!stillOnline) {
              await presenceService.setLastSeen(userId);

              const lastSeenStr = await presenceService.getLastSeen(userId);

              await presencePublisher.publish(
                userId,
                PresenceStatus.OFFLINE,
                lastSeenStr ? new Date(lastSeenStr) : undefined,
              );
            }
          },
        },
      },
      introspection: !isProduction,
    };
  },
});
