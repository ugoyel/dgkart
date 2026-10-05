import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApi } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'uploads/(.*)'] });
  app.enableCors({ origin: config.get('corsOrigins') === '*' ? true : config.get('corsOrigins') });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  SwaggerModule.setup('docs', app, buildOpenApi(app));
  const port = config.get<number>('port')!;
  await app.listen(port, '0.0.0.0');
  Logger.log(`DGkart API on :${port}  (docs at /docs, auth=${config.get('authMode')}, payments=${config.get('paymentProvider')})`, 'Bootstrap');
}
bootstrap();
