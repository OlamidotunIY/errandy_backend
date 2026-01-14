import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { graphqlUploadExpress } from 'graphql-upload-ts';
import { ConfigService } from '@nestjs/config';
import * as dns from 'node:dns';
import { json, urlencoded } from 'express';
dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Raw health endpoint BEFORE any auth middleware
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const configService = app.get(ConfigService);

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
    'exp://localhost:8081',
    'https://errandy.com.ng',
    'https://www.errandy.com.ng',
    'https://api.errandy.com',
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

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap().catch((error) => {
  console.error('Failed to start microservice:', error);
  process.exit(1);
});
