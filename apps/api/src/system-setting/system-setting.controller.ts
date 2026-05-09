import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { SystemSettingService } from './system-setting.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class UpdateSettingDto {
  @IsString() value: string;
}

@Controller('admin/system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SystemSettingController {
  constructor(private readonly service: SystemSettingService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.service.update(key, dto.value);
  }
}
