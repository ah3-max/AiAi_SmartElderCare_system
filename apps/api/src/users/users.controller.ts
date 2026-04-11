import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { IsString, IsEnum, IsOptional, IsInt, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class CreateUserDto {
  @IsString() username: string;
  @IsString() @MinLength(8) password: string;
  @IsString() name: string;
  @IsEnum(UserRole) role: UserRole;
  @IsOptional() @IsString() building?: string;
  @IsOptional() @IsInt() floor?: number;
}

class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() building?: string;
  @IsOptional() @IsInt() floor?: number;
}

class ResetPasswordDto {
  @IsString() @MinLength(8) newPassword: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query('building') building?: string) {
    return this.usersService.findAll(building);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(id, dto.newPassword);
  }
}
