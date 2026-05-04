import { Module } from '@nestjs/common';
import { LineBotService } from './line-bot.service';
import { LineBotController, FaqAdminController } from './line-bot.controller';

@Module({
  providers: [LineBotService],
  controllers: [LineBotController, FaqAdminController],
  exports: [LineBotService],
})
export class LineBotModule {}
