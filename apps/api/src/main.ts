import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { createMetricsServer } from './metrics-server';
import { validateWebAuthnConfig, WebAuthnConfig } from './config/webauthn-config.validator';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Validate WebAuthn (passkey) config early so misconfigured RP ID / origin
  // pairs fail boot with a clear error rather than producing silent browser
  // rejections at registration/authentication time.
  validateWebAuthnConfig(configService.get<WebAuthnConfig>('webauthn')!);

  // Start the internal metrics server (port 9464)
  await createMetricsServer();
  
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

  // Start main API server
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API server running on: http://localhost:${port}`);
  console.log(`📊 Metrics available internally at: http://localhost:9464/metrics`);
}

bootstrap();