import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtModule } from './jwt/jwt.module';
import { CybersourceModule } from './cybersource/cybersource.module';
import { PaymentModule } from './payment/payment.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,  // Makes ConfigService available everywhere
      envFilePath: '.env',
    }),
    JwtModule, CybersourceModule, PaymentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
