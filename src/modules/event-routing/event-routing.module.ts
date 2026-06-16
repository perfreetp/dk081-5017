import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SecurityEvent,
  EventFlowTrail,
  PersonStayRecord,
  Person,
  Area,
} from '../../infrastructure/entities';
import { EventRoutingService } from './services/event-routing.service';
import { EventRoutingController } from './controllers/event-routing.controller';
import { RuleOrchestrationModule } from '../rule-orchestration/rule-orchestration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SecurityEvent,
      EventFlowTrail,
      PersonStayRecord,
      Person,
      Area,
    ]),
    RuleOrchestrationModule,
  ],
  providers: [EventRoutingService],
  controllers: [EventRoutingController],
  exports: [EventRoutingService],
})
export class EventRoutingModule {}
