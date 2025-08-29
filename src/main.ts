import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { graphqlUploadExpress } from 'graphql-upload-ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const allowedOrigins = ['http://localhost:5173'];

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

  await app.listen(3001);
}
bootstrap().catch((error) => {
  console.error('Failed to start microservice:', error);
  process.exit(1);
});
