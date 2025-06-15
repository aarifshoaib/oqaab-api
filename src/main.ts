import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "frame-ancestors https://testflex.cybersource.com");
    next();
  });
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
