import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { ContractPublicController, ContractAdminController } from './contract.controller';

@Module({
  providers: [ContractService],
  controllers: [ContractPublicController, ContractAdminController],
  exports: [ContractService],
})
export class ContractModule {}
