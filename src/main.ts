import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { graphqlUploadExpress } from 'graphql-upload-ts';
import { ConfigService } from '@nestjs/config';
import * as dns from 'node:dns';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from 'auth';
dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const configService = app.get(ConfigService);

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
    'exp://localhost:8081',
    'https://errandy.com.ng',
    'https://www.errandy.com.ng',
    'https://api.errandy.com',
    'exp://192.168.0.105:8081',
    'exp://192.168.0.105:19000',
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: [
      'Accept',
      'Authorization',
      'Content-Type',
      'X-Requested-With',
      'apollo-require-preflight',
    ],
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const formattedErrors = errors.reduce(
          (accumulator, error) => {
            accumulator[error.property] = Object.values(
              error.constraints ?? {},
            ).join(', ');
            return accumulator;
          },
          {} as Record<string, string>,
        ); // ensure proper typing

        throw new BadRequestException(formattedErrors);
      },
    }),
  );
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }));
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Mount Better-Auth HTTP handler
  const authHandler = toNodeHandler(auth);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.originalUrl?.startsWith('/api/auth') ||
      req.url?.startsWith('/api/auth')
    ) {
      return authHandler(req, res);
    }
    next();
  });

  const port = Number(process.env.PORT) || 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`Listening on 0.0.0.0:${port}`);
}
bootstrap().catch((error) => {
  console.error('Failed to start microservice:', error);
  process.exit(1);
});
