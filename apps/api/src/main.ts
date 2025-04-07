import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply helmet middleware for security headers
  app.use(helmet());
  
  // Global validation and sanitization pipe
  app.useGlobalPipes(new GlobalValidationPipe());

  // CORS configuration
  app.enableCors();
  
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