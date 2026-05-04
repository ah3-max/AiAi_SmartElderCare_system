import { Module } from '@nestjs/common';
import { LineBotService } from './line-bot.service';
import { LineBotController } from './line-bot.controller';

@Module({
  providers: [LineBotService],
  controllers: [LineBotController],
  exports: [LineBotService],
})
export class LineBotModule {}
