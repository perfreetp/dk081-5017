import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  FalseAlarmStatistic,
  StrictModeConfig,
  SecurityEvent,
  StayRule,
  Hospital,
  EventFlowTrail,
} from '../../infrastructure/entities';
import { AuditService } from './services/audit.service';
import { ReportService } from './services/report.service';
import { StrictModeService } from './services/strict-mode.service';
import {
  AuditLogController,
  ReportController,
  FalseAlarmController,
  StrictModeController,
} from './controllers/audit.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      FalseAlarmStatistic,
      StrictModeConfig,
      SecurityEvent,
      StayRule,
      Hospital,
      EventFlowTrail,
    ]),
  ],
  providers: [AuditService, ReportService, StrictModeService],
  controllers: [
    AuditLogController,
    ReportController,
    FalseAlarmController,
    StrictModeController,
  ],
  exports: [AuditService, ReportService, StrictModeService],
})
export class AuditModule {}
