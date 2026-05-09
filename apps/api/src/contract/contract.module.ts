import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { ContractPublicController, ContractAdminController } from './contract.controller';
import { TwcaService } from './twca.service';
import { PdfService } from './pdf.service';

@Module({
  providers: [ContractService, TwcaService, PdfService],
  controllers: [ContractPublicController, ContractAdminController],
  exports: [ContractService],
})
export class ContractModule {}
