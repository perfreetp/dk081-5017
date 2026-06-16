import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, FalseAlarmStatistic } from '../../../infrastructure/entities';
import {
  QueryAuditLogDto,
  QueryFalseAlarmStatDto,
  QueryReportDto,
} from '../dto/audit.dto';
import { PaginationDto, PaginatedResultDto } from '../../../common/dto/common.dto';
import { OnEvent } from '@nestjs/event-emitter';
import { FalseAlarmCategory } from '../../../common/enums';
import * as dayjs from 'dayjs';

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(FalseAlarmStatistic) private readonly falseAlarmStatRepo: Repository<FalseAlarmStatistic>,
  ) {}

  onModuleInit() {
    this.logger.log('审计服务已启动');
  }

  @OnEvent('audit.log')
  async handleAuditLog(payload: any) {
    await this.createLog(payload);
  }

  async createLog(data: Partial<AuditLog>): Promise<AuditLog> {
    const log = this.auditRepo.create(data);
    return this.auditRepo.save(log);
  }

  async queryLogs(
    query: QueryAuditLogDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResultDto<AuditLog>> {
    const qb = this.auditRepo.createQueryBuilder('a').where('1=1');

    if (query.hospitalId) qb.andWhere('a.hospitalId = :hospitalId', { hospitalId: query.hospitalId });
    if (query.eventId) qb.andWhere('a.eventId = :eventId', { eventId: query.eventId });
    if (query.userId) qb.andWhere('a.userId = :userId', { userId: query.userId });
    if (query.actionType) qb.andWhere('a.actionType = :actionType', { actionType: query.actionType });
    if (query.startTime) qb.andWhere('a.createdAt >= :startTime', { startTime: query.startTime });
    if (query.endTime) qb.andWhere('a.createdAt <= :endTime', { endTime: query.endTime });
    if (query.keyword) {
      qb.andWhere(
        '(a.actionType LIKE :keyword OR a.actionDetail LIKE :keyword OR a.userName LIKE :keyword)',
        { keyword: `%${query.keyword}%` },
      );
    }

    qb.orderBy('a.createdAt', 'DESC')
      .skip((pagination.page - 1) * pagination.pageSize)
      .take(pagination.pageSize);

    const [list, total] = await qb.getManyAndCount();
    return PaginatedResultDto.create(list, total, pagination.page, pagination.pageSize);
  }

  @OnEvent('event.false_alarm')
  async handleFalseAlarm(payload: { eventId: string; category: FalseAlarmCategory; hospitalId: string }) {
    const today = dayjs().format('YYYY-MM-DD');
    let stat = await this.falseAlarmStatRepo.findOneBy({
      hospitalId: payload.hospitalId,
      category: payload.category,
      statDate: today,
    }) as FalseAlarmStatistic;

    if (!stat) {
      stat = this.falseAlarmStatRepo.create({
        hospitalId: payload.hospitalId,
        category: payload.category,
        statDate: today,
        count: 0,
      });
    }
    stat.count += 1;
    await this.falseAlarmStatRepo.save(stat);
  }

  async getFalseAlarmStatistics(query: QueryFalseAlarmStatDto): Promise<any[]> {
    const qb = this.falseAlarmStatRepo.createQueryBuilder('s');

    if (query.hospitalId) qb.andWhere('s.hospitalId = :hospitalId', { hospitalId: query.hospitalId });
    if (query.category) qb.andWhere('s.category = :category', { category: query.category });
    if (query.startDate) qb.andWhere('s.statDate >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('s.statDate <= :endDate', { endDate: query.endDate });

    qb.orderBy('s.statDate', 'DESC');
    const stats = await qb.getMany();

    const categoryMap: Record<FalseAlarmCategory, { name: string; total: number; trend: any[] }> = {
      [FalseAlarmCategory.SYSTEM_ERROR]: { name: '系统误差', total: 0, trend: [] },
      [FalseAlarmCategory.PERSONNEL_AUTHORIZED]: { name: '授权人员', total: 0, trend: [] },
      [FalseAlarmCategory.ENVIRONMENT_FACTOR]: { name: '环境因素', total: 0, trend: [] },
      [FalseAlarmCategory.RULE_MISCONFIGURATION]: { name: '规则配置', total: 0, trend: [] },
      [FalseAlarmCategory.OTHER]: { name: '其他', total: 0, trend: [] },
    };

    for (const stat of stats) {
      categoryMap[stat.category].total += stat.count;
      categoryMap[stat.category].trend.push({
        date: stat.statDate,
        count: stat.count,
      });
    }

    return Object.entries(categoryMap).map(([key, val]) => ({
      category: key,
      categoryName: val.name,
      total: val.total,
      trend: val.trend,
    }));
  }
}
