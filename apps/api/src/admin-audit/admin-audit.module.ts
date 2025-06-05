import { Module } from '@nestjs/common';
import { AdminAuditService } from './services/admin-audit.service';

@Module({
  providers: [AdminAuditService],
  exports: [AdminAuditService], // Export the service so other modules can use it
})
export class AdminAuditModule {} 