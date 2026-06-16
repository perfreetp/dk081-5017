import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StayRule, TimeSlotSensitivity, Area, StrictModeConfig } from '../../infrastructure/entities';
import { StayRuleService } from './services/stay-rule.service';
import { StayRuleController } from './controllers/stay-rule.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StayRule, TimeSlotSensitivity, Area, StrictModeConfig]),
  ],
  providers: [StayRuleService],
  controllers: [StayRuleController],
  exports: [StayRuleService],
})
export class RuleOrchestrationModule {}
