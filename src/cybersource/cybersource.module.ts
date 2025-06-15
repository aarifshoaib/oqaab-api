// cybersource.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CybersourceService } from './cybersource.service';
import { CybersourceController } from './cybersource.controller';

@Module({
  imports: [ConfigModule],
  providers: [CybersourceService],
  controllers: [CybersourceController],
  exports: [CybersourceService],
})
export class CybersourceModule { }

