import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateResidentLeaveDto } from './create-resident-leave.dto';

export class UpdateResidentLeaveDto extends PartialType(
  OmitType(CreateResidentLeaveDto, ['residentId'] as const),
) {}
