import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { FaqService } from './faq.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateFaqDto {
  @IsString() keyword: string;
  @IsString() question: string;
  @IsString() answer: string;
  @IsOptional() @IsInt() @Min(0) priority?: number;
}

class UpdateFaqDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() question?: string;
  @IsOptional() @IsString() answer?: string;
  @IsOptional() @IsInt() @Min(0) priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('admin/faq')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  findAll() {
    return this.faqService.findAll();
  }

  @Post()
  create(@Body() dto: CreateFaqDto) {
    return this.faqService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.faqService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.faqService.remove(id);
  }
}
