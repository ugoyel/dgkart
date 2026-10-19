import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('DGkart API')
    .setDescription('REST API shared by the DGkart mobile app and the future DGkart.com website.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
