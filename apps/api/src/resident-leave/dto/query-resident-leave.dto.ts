import { IsOptional, IsString, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LeaveType } from '@prisma/client';

export class QueryResidentLeaveDto {
  @IsOptional()
  @IsString()
  residentId?: string;

  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

  /** 篩選開始日期（含）*/
  @IsOptional()
  @IsDateString()
  from?: string;

  /** 篩選結束日期（含）*/
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
