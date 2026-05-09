import { Global, Module } from '@nestjs/common';
import { SystemSettingService } from './system-setting.service';
import { SystemSettingController } from './system-setting.controller';

@Global()
@Module({
  providers: [SystemSettingService],
  controllers: [SystemSettingController],
  exports: [SystemSettingService],
})
export class SystemSettingModule {}
