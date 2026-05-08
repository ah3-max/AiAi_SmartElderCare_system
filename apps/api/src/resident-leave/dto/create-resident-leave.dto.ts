import { IsString, IsDateString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class CreateResidentLeaveDto {
  @IsString()
  residentId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @MinLength(1)
  reason: string;

  @IsEnum(LeaveType)
  @IsOptional()
  leaveType?: LeaveType;

  @IsString()
  @IsOptional()
  notes?: string;
}
