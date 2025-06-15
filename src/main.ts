import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "frame-ancestors https://testflex.cybersource.com");
    next();
  });
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite default
      'http://localhost:4200', // Angular default
      'https://your-frontend-domain.com', // Your actual frontend domain
      /https:\/\/.*\.ngrok-free\.app$/, // Allow any ngrok URL
      /https:\/\/.*\.ngrok\.io$/ // Allow ngrok.io URLs too
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ngrok-skip-browser-warning',
      'X-Requested-With',
      'Accept',
      'Origin'
    ],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
