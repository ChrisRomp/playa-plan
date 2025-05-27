import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Apply helmet middleware for security headers
  app.use(helmet());
  
  // Global validation and sanitization pipe
  app.useGlobalPipes(new GlobalValidationPipe());

  // CORS configuration using settings from config service
  const corsConfig = configService.get('cors');
  app.enableCors({
    origin: corsConfig.origins,
    methods: corsConfig.methods,
    credentials: corsConfig.credentials,
    allowedHeaders: corsConfig.allowedHeaders,
    exposedHeaders: corsConfig.exposedHeaders,
    maxAge: corsConfig.maxAge,
  });
  
  console.log(`CORS configured with origins: ${corsConfig.origins}`);
  
  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('PlayaPlan API')
    .setDescription('API for managing camp registrations and shifts')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();