import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ResidentLeaveService } from './resident-leave.service';
import { CreateResidentLeaveDto } from './dto/create-resident-leave.dto';
import { UpdateResidentLeaveDto } from './dto/update-resident-leave.dto';
import { QueryResidentLeaveDto } from './dto/query-resident-leave.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/resident-leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResidentLeaveController {
  constructor(private readonly service: ResidentLeaveService) {}

  @Get()
  findAll(@Query() query: QueryResidentLeaveDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateResidentLeaveDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateResidentLeaveDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
