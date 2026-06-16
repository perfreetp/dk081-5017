import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SecurityEvent,
  StayRule,
  Hospital,
  EventFlowTrail,
} from '../../../infrastructure/entities';
import { QueryReportDto } from '../dto/audit.dto';
import { EventStatus, EventLevel, FalseAlarmCategory } from '../../../common/enums';
import * as dayjs from 'dayjs';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(SecurityEvent) private readonly eventRepo: Repository<SecurityEvent>,
    @InjectRepository(StayRule) private readonly ruleRepo: Repository<StayRule>,
    @InjectRepository(Hospital) private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(EventFlowTrail) private readonly flowTrailRepo: Repository<EventFlowTrail>,
  ) {}

  async getRuleHitRateReport(query: QueryReportDto): Promise<any[]> {
    const hospitals = await this.hospitalRepo.find({ where: { isDeleted: false } });
    const rules = await this.ruleRepo.find({ where: { isDeleted: false } });

    const reports: any[] = [];

    for (const hospital of hospitals) {
      if (query.hospitalId && query.hospitalId !== hospital.id) continue;

      const eventQb = this.eventRepo
        .createQueryBuilder('e')
        .where('e.hospitalId = :hospitalId AND e.isDeleted = 0', { hospitalId: hospital.id });

      if (query.startDate) eventQb.andWhere('e.firstDetectedAt >= :startDate', { startDate: query.startDate });
      if (query.endDate) eventQb.andWhere('e.firstDetectedAt <= :endDate', { endDate: query.endDate });

      const totalEvents = await eventQb.getCount();

      const ruleStats: any[] = [];
      for (const rule of rules) {
        if (rule.hospitalId && rule.hospitalId !== hospital.id) continue;

        const ruleEventQb = this.eventRepo
          .createQueryBuilder('e')
          .where('e.hospitalId = :hospitalId AND e.matchedRuleId = :ruleId AND e.isDeleted = 0', {
            hospitalId: hospital.id,
            ruleId: rule.id,
          });

        if (query.startDate) ruleEventQb.andWhere('e.firstDetectedAt >= :startDate', { startDate: query.startDate });
        if (query.endDate) ruleEventQb.andWhere('e.firstDetectedAt <= :endDate', { endDate: query.endDate });

        const hitCount = await ruleEventQb.getCount();

        ruleStats.push({
          ruleId: rule.id,
          ruleName: rule.name,
          sceneType: rule.sceneType,
          eventLevel: rule.eventLevel,
          hitCount,
          hitRate: totalEvents > 0 ? Math.round((hitCount / totalEvents) * 100) : 0,
        });
      }

      reports.push({
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        totalEvents,
        ruleStats: ruleStats.sort((a, b) => b.hitCount - a.hitCount),
      });
    }

    return reports;
  }

  async getHandlingDurationReport(query: QueryReportDto): Promise<any[]> {
    const hospitals = await this.hospitalRepo.find({ where: { isDeleted: false } });
    const reports: any[] = [];

    for (const hospital of hospitals) {
      if (query.hospitalId && query.hospitalId !== hospital.id) continue;

      const qb = this.eventRepo
        .createQueryBuilder('e')
        .where(
          'e.hospitalId = :hospitalId AND e.isDeleted = 0 AND e.handlingDurationSeconds > 0 AND e.status IN (:...statuses)',
          {
            hospitalId: hospital.id,
            statuses: [EventStatus.RESOLVED, EventStatus.CLOSED, EventStatus.FALSE_ALARM],
          },
        );

      if (query.startDate) qb.andWhere('e.firstDetectedAt >= :startDate', { startDate: query.startDate });
      if (query.endDate) qb.andWhere('e.firstDetectedAt <= :endDate', { endDate: query.endDate });

      const events = await qb.getMany();

      if (events.length === 0) {
        reports.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          totalHandled: 0,
          avgHandlingSeconds: 0,
          avgHandlingMinutes: 0,
          medianHandlingSeconds: 0,
          levelBreakdown: [],
        });
        continue;
      }

      const durations = events.map(e => e.handlingDurationSeconds).sort((a, b) => a - b);
      const total = durations.reduce((sum, d) => sum + d, 0);
      const avg = Math.round(total / durations.length);
      const median = durations.length % 2 === 0
        ? Math.round((durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2)
        : durations[Math.floor(durations.length / 2)];

      const levelBreakdown: any[] = [];
      for (const level of [EventLevel.LOW, EventLevel.MEDIUM, EventLevel.HIGH, EventLevel.CRITICAL]) {
        const levelEvents = events.filter(e => e.eventLevel === level);
        if (levelEvents.length > 0) {
          const levelDurations = levelEvents.map(e => e.handlingDurationSeconds);
          const levelAvg = Math.round(levelDurations.reduce((sum, d) => sum + d, 0) / levelDurations.length);
          levelBreakdown.push({
            level,
            count: levelEvents.length,
            avgHandlingSeconds: levelAvg,
            avgHandlingMinutes: Math.round(levelAvg / 60),
          });
        }
      }

      reports.push({
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        totalHandled: events.length,
        avgHandlingSeconds: avg,
        avgHandlingMinutes: Math.round(avg / 60),
        medianHandlingSeconds: median,
        medianHandlingMinutes: Math.round(median / 60),
        levelBreakdown,
      });
    }

    return reports;
  }

  async getEscalationRateReport(query: QueryReportDto): Promise<any[]> {
    const hospitals = await this.hospitalRepo.find({ where: { isDeleted: false } });
    const reports: any[] = [];

    for (const hospital of hospitals) {
      if (query.hospitalId && query.hospitalId !== hospital.id) continue;

      const totalQb = this.eventRepo
        .createQueryBuilder('e')
        .where('e.hospitalId = :hospitalId AND e.isDeleted = 0', { hospitalId: hospital.id });

      if (query.startDate) totalQb.andWhere('e.firstDetectedAt >= :startDate', { startDate: query.startDate });
      if (query.endDate) totalQb.andWhere('e.firstDetectedAt <= :endDate', { endDate: query.endDate });

      const total = await totalQb.getCount();

      const escalatedQb = this.eventRepo
        .createQueryBuilder('e')
        .where('e.hospitalId = :hospitalId AND e.isDeleted = 0 AND e.isKeyFocus = 1', {
          hospitalId: hospital.id,
        });

      if (query.startDate) escalatedQb.andWhere('e.firstDetectedAt >= :startDate', { startDate: query.startDate });
      if (query.endDate) escalatedQb.andWhere('e.firstDetectedAt <= :endDate', { endDate: query.endDate });

      const escalated = await escalatedQb.getCount();

      const falseAlarmQb = this.eventRepo
        .createQueryBuilder('e')
        .where('e.hospitalId = :hospitalId AND e.isDeleted = 0 AND e.status = :status', {
          hospitalId: hospital.id,
          status: EventStatus.FALSE_ALARM,
        });

      if (query.startDate) falseAlarmQb.andWhere('e.firstDetectedAt >= :startDate', { startDate: query.startDate });
      if (query.endDate) falseAlarmQb.andWhere('e.firstDetectedAt <= :endDate', { endDate: query.endDate });

      const falseAlarms = await falseAlarmQb.getCount();

      reports.push({
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        totalEvents: total,
        escalatedCount: escalated,
        escalationRate: total > 0 ? Math.round((escalated / total) * 100) : 0,
        falseAlarmCount: falseAlarms,
        falseAlarmRate: total > 0 ? Math.round((falseAlarms / total) * 100) : 0,
        effectiveEvents: total - falseAlarms,
        effectiveRate: total > 0 ? Math.round(((total - falseAlarms) / total) * 100) : 0,
      });
    }

    return reports;
  }

  async getTrendReport(query: QueryReportDto): Promise<any> {
    const startDate = query.startDate ? dayjs(query.startDate) : dayjs().subtract(30, 'day');
    const endDate = query.endDate ? dayjs(query.endDate) : dayjs();
    const days = endDate.diff(startDate, 'day') + 1;

    const dailyData: any[] = [];
    for (let i = 0; i < days; i++) {
      const currentDay = startDate.add(i, 'day');
      const dayStart = currentDay.startOf('day').toDate();
      const dayEnd = currentDay.endOf('day').toDate();

      const qb = this.eventRepo
        .createQueryBuilder('e')
        .where('e.isDeleted = 0 AND e.firstDetectedAt >= :dayStart AND e.firstDetectedAt <= :dayEnd', {
          dayStart,
          dayEnd,
        });

      if (query.hospitalId) qb.andWhere('e.hospitalId = :hospitalId', { hospitalId: query.hospitalId });

      const total = await qb.getCount();

      const levelCounts: Record<string, number> = {};
      for (const level of [EventLevel.LOW, EventLevel.MEDIUM, EventLevel.HIGH, EventLevel.CRITICAL]) {
        const levelQb = this.eventRepo
          .createQueryBuilder('e')
          .where(
            'e.isDeleted = 0 AND e.firstDetectedAt >= :dayStart AND e.firstDetectedAt <= :dayEnd AND e.eventLevel = :level',
            { dayStart, dayEnd, level },
          );
        if (query.hospitalId) levelQb.andWhere('e.hospitalId = :hospitalId', { hospitalId: query.hospitalId });
        levelCounts[level] = await levelQb.getCount();
      }

      dailyData.push({
        date: currentDay.format('YYYY-MM-DD'),
        total,
        ...levelCounts,
      });
    }

    return {
      dateRange: {
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD'),
        days,
      },
      dailyData,
    };
  }

  async getGroupDashboard(query: QueryReportDto): Promise<any> {
    const [hitRates, handlingDurations, escalationRates, trend] = await Promise.all([
      this.getRuleHitRateReport(query),
      this.getHandlingDurationReport(query),
      this.getEscalationRateReport(query),
      this.getTrendReport(query),
    ]);

    const totalEvents = hitRates.reduce((sum, h) => sum + h.totalEvents, 0);
    const avgHandlingSeconds = handlingDurations.length > 0
      ? Math.round(
          handlingDurations.reduce((sum, h) => sum + h.avgHandlingSeconds * h.totalHandled, 0) /
            Math.max(handlingDurations.reduce((sum, h) => sum + h.totalHandled, 0), 1),
        )
      : 0;
    const totalEscalated = escalationRates.reduce((sum, h) => sum + h.escalatedCount, 0);
    const totalFalseAlarms = escalationRates.reduce((sum, h) => sum + h.falseAlarmCount, 0);

    return {
      summary: {
        totalEvents,
        avgHandlingSeconds,
        avgHandlingMinutes: Math.round(avgHandlingSeconds / 60),
        totalEscalated,
        escalationRate: totalEvents > 0 ? Math.round((totalEscalated / totalEvents) * 100) : 0,
        totalFalseAlarms,
        falseAlarmRate: totalEvents > 0 ? Math.round((totalFalseAlarms / totalEvents) * 100) : 0,
      },
      byHospital: {
        hitRates,
        handlingDurations,
        escalationRates,
      },
      trend,
    };
  }
}
