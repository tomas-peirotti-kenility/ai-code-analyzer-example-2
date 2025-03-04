import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VersioningType } from '@nestjs/common';
import AllExceptionsFilter from './utils/exceptions/AllExceptionsFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger:
      process.env.NODE_ENV && process.env.NODE_ENV === 'production'
        ? ['error', 'log', 'warn']
        : ['debug', 'error', 'log', 'warn'],
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const config = new DocumentBuilder()
    .setTitle('AIVA Playground API')
    .setDescription('Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // Create the Swagger document
  const document = SwaggerModule.createDocument(app, config);

  // Transform the paths to include the version prefix
  document.paths = Object.keys(document.paths).reduce((paths, path) => {
    paths[`/v1${path}`] = document.paths[path];
    return paths;
  }, {});

  // Setup Swagger module
  SwaggerModule.setup('docs', app, document);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.API_PORT);
  console.log('Playground API is running, port: ' + process.env.API_PORT);
}
bootstrap();
