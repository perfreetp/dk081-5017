import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StayRule, TimeSlotSensitivity, Area, StrictModeConfig } from '../../../infrastructure/entities';
import {
  CreateStayRuleDto,
  UpdateStayRuleDto,
  QueryStayRuleDto,
  MatchedRuleResult,
} from '../dto/stay-rule.dto';
import { PaginationDto, PaginatedResultDto } from '../../../common/dto/common.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventLevel, SensitivityLevel, SceneType } from '../../../common/enums';
import * as dayjs from 'dayjs';

@Injectable()
export class StayRuleService {
  constructor(
    @InjectRepository(StayRule) private readonly ruleRepo: Repository<StayRule>,
    @InjectRepository(TimeSlotSensitivity) private readonly timeSlotRepo: Repository<TimeSlotSensitivity>,
    @InjectRepository(Area) private readonly areaRepo: Repository<Area>,
    @InjectRepository(StrictModeConfig) private readonly strictModeRepo: Repository<StrictModeConfig>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createRule(dto: CreateStayRuleDto, operator: any): Promise<StayRule> {
    const rule = this.ruleRepo.create({
      ...dto,
      defaultSensitivity: dto.defaultSensitivity || SensitivityLevel.MEDIUM,
      createdBy: operator.userId,
      updatedBy: operator.userId,
    });

    if (dto.timeSlotSensitivities && dto.timeSlotSensitivities.length > 0) {
      rule.timeSlotSensitivities = dto.timeSlotSensitivities.map(slot =>
        this.timeSlotRepo.create({ ...slot, enabled: true }),
      );
    }

    const saved = await this.ruleRepo.save(rule);
    this.emitAudit('rule.create', operator, saved.id, saved);
    return saved;
  }

  async updateRule(id: string, dto: UpdateStayRuleDto, operator: any): Promise<StayRule> {
    const rule = await this.findRuleById(id);
    const { timeSlotSensitivities, ...rest } = dto;

    const merged = this.ruleRepo.merge(rule, { ...rest, updatedBy: operator.userId });

    if (timeSlotSensitivities) {
      await this.timeSlotRepo.delete({ ruleId: id });
      merged.timeSlotSensitivities = timeSlotSensitivities.map(slot =>
        this.timeSlotRepo.create({ ...slot, enabled: true }),
      );
    }

    const saved = await this.ruleRepo.save(merged);
    this.emitAudit('rule.update', operator, saved.id, dto);
    return saved;
  }

  async findRuleById(id: string): Promise<StayRule> {
    const rule = await this.ruleRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['timeSlotSensitivities'],
    }) as StayRule;
    if (!rule) throw new NotFoundException(`规则不存在: ${id}`);
    return rule;
  }

  async queryRules(query: QueryStayRuleDto, pagination: PaginationDto): Promise<PaginatedResultDto<StayRule>> {
    const qb = this.ruleRepo.createQueryBuilder('r').where('r.isDeleted = :isDeleted', { isDeleted: false });

    if (query.hospitalId) qb.andWhere('r.hospitalId = :hospitalId', { hospitalId: query.hospitalId });
    if (query.areaId) qb.andWhere('r.areaId = :areaId', { areaId: query.areaId });
    if (query.sceneType) qb.andWhere('r.sceneType = :sceneType', { sceneType: query.sceneType });
    if (query.eventLevel) qb.andWhere('r.eventLevel = :eventLevel', { eventLevel: query.eventLevel });
    if (query.enabled !== undefined) qb.andWhere('r.enabled = :enabled', { enabled: query.enabled });
    if (query.keyword) qb.andWhere('(r.name LIKE :keyword OR r.description LIKE :keyword)', { keyword: `%${query.keyword}%` });

    qb.orderBy('r.priority', 'DESC')
      .addOrderBy('r.createdAt', 'DESC')
      .leftJoinAndSelect('r.timeSlotSensitivities', 'slots')
      .skip((pagination.page - 1) * pagination.pageSize)
      .take(pagination.pageSize);

    const [list, total] = await qb.getManyAndCount();
    return PaginatedResultDto.create(list, total, pagination.page, pagination.pageSize);
  }

  async matchRules(
    areaId: string,
    hospitalId: string,
    atTime?: Date,
  ): Promise<MatchedRuleResult | null> {
    const targetTime = atTime || new Date();
    const area = await this.areaRepo.findOneBy({ id: areaId, isDeleted: false }) as Area;
    if (!area) return null;

    const qb = this.ruleRepo
      .createQueryBuilder('r')
      .where('r.isDeleted = :isDeleted AND r.enabled = :enabled', {
        isDeleted: false,
        enabled: true,
      })
      .andWhere(
        '(r.areaId = :areaId OR r.sceneType = :sceneType OR (r.hospitalId = :hospitalId AND r.areaId IS NULL AND r.sceneType IS NULL))',
        { areaId, sceneType: area.sceneType, hospitalId },
      )
      .orderBy('r.priority', 'DESC')
      .leftJoinAndSelect('r.timeSlotSensitivities', 'slots');

    const rules = await qb.getMany();
    if (rules.length === 0) return null;

    const matchedRule = rules[0];
    const result = this.applyTimeSlotSensitivity(matchedRule, targetTime);

    const strictModeActive = await this.checkStrictModeActive(hospitalId, targetTime);
    if (strictModeActive && matchedRule.applyToStrictMode) {
      return this.applyStrictModeOverride(result, matchedRule, strictModeActive);
    }

    return result;
  }

  private applyTimeSlotSensitivity(rule: StayRule, targetTime: Date): MatchedRuleResult {
    const now = dayjs(targetTime);
    const currentTime = now.format('HH:mm');
    const currentWeekday = now.day();

    let result: MatchedRuleResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      maxStaySeconds: rule.maxStaySeconds,
      warningStaySeconds: rule.warningStaySeconds,
      eventLevel: rule.eventLevel,
      sensitivity: rule.defaultSensitivity,
      notificationTargets: rule.notificationTargets,
      mergeSamePerson: rule.mergeSamePerson,
      mergeTimeWindowSeconds: rule.mergeTimeWindowSeconds,
      isStrictModeApplied: false,
    };

    if (!rule.timeSlotSensitivities || rule.timeSlotSensitivities.length === 0) {
      return result;
    }

    for (const slot of rule.timeSlotSensitivities) {
      if (!slot.enabled) continue;
      if (slot.weekdays.length > 0 && !slot.weekdays.includes(currentWeekday)) continue;

      if (this.isTimeInRange(currentTime, slot.startTime, slot.endTime)) {
        result.sensitivity = slot.sensitivityLevel;
        if (slot.overrideMaxStaySeconds) {
          result.maxStaySeconds = slot.overrideMaxStaySeconds;
        }
        if (slot.overrideEventLevel) {
          result.eventLevel = slot.overrideEventLevel;
        }
        break;
      }
    }

    const sensitivityMultiplier = this.getSensitivityMultiplier(result.sensitivity);
    if (sensitivityMultiplier !== 1) {
      result.maxStaySeconds = Math.round(result.maxStaySeconds * sensitivityMultiplier);
      result.warningStaySeconds = Math.round(result.warningStaySeconds * sensitivityMultiplier);
    }

    return result;
  }

  private isTimeInRange(current: string, start: string, end: string): boolean {
    if (start <= end) {
      return current >= start && current <= end;
    } else {
      return current >= start || current <= end;
    }
  }

  private getSensitivityMultiplier(sensitivity: SensitivityLevel): number {
    switch (sensitivity) {
      case SensitivityLevel.LOW:
        return 1.5;
      case SensitivityLevel.MEDIUM:
        return 1;
      case SensitivityLevel.HIGH:
        return 0.7;
      case SensitivityLevel.VERY_HIGH:
        return 0.5;
      default:
        return 1;
    }
  }

  private async checkStrictModeActive(hospitalId: string, targetTime: Date): Promise<StrictModeConfig | null> {
    const qb = this.strictModeRepo
      .createQueryBuilder('s')
      .where('s.isDeleted = :isDeleted AND s.enabled = :enabled', {
        isDeleted: false,
        enabled: true,
      })
      .andWhere('s.startTime <= :targetTime AND s.endTime >= :targetTime', { targetTime })
      .andWhere('(s.hospitalId IS NULL OR s.hospitalId = :hospitalId)', { hospitalId });

    const configs = await qb.getMany();
    for (const config of configs) {
      if (config.scopeHospitalIds.length === 0 || config.scopeHospitalIds.includes(hospitalId)) {
        return config;
      }
    }
    return null;
  }

  private applyStrictModeOverride(
    result: MatchedRuleResult,
    rule: StayRule,
    strictConfig: StrictModeConfig,
  ): MatchedRuleResult {
    const modified = { ...result, isStrictModeApplied: true };

    if (rule.strictModeOverride) {
      modified.maxStaySeconds = rule.strictModeOverride.maxStaySeconds;
      modified.eventLevel = rule.strictModeOverride.eventLevel;
    } else {
      modified.maxStaySeconds = Math.round(
        modified.maxStaySeconds * (1 - strictConfig.sensitivityMultiplier / 100),
      );
    }

    const existingTargets = new Set(modified.notificationTargets);
    strictConfig.forcedNotificationTargets.forEach(t => existingTargets.add(t));
    modified.notificationTargets = Array.from(existingTargets);

    if (modified.eventLevel === EventLevel.LOW || modified.eventLevel === EventLevel.MEDIUM) {
      modified.eventLevel = EventLevel.HIGH;
    }

    return modified;
  }

  async getScenePresets(): Promise<Array<{ scene: SceneType; defaultSeconds: number; eventLevel: EventLevel }>> {
    return [
      { scene: SceneType.PEDIATRICS, defaultSeconds: 600, eventLevel: EventLevel.MEDIUM },
      { scene: SceneType.EMERGENCY, defaultSeconds: 900, eventLevel: EventLevel.HIGH },
      { scene: SceneType.OPERATING_ROOM, defaultSeconds: 1800, eventLevel: EventLevel.HIGH },
      { scene: SceneType.PHARMACY, defaultSeconds: 300, eventLevel: EventLevel.CRITICAL },
      { scene: SceneType.ICU, defaultSeconds: 1200, eventLevel: EventLevel.HIGH },
      { scene: SceneType.NICU, defaultSeconds: 1200, eventLevel: EventLevel.HIGH },
      { scene: SceneType.WARD, defaultSeconds: 1800, eventLevel: EventLevel.LOW },
      { scene: SceneType.LOBBY, defaultSeconds: 1800, eventLevel: EventLevel.LOW },
      { scene: SceneType.PARKING, defaultSeconds: 3600, eventLevel: EventLevel.LOW },
      { scene: SceneType.OTHER, defaultSeconds: 1800, eventLevel: EventLevel.MEDIUM },
    ];
  }

  private emitAudit(action: string, operator: any, targetId: string, data: any) {
    this.eventEmitter.emit('audit.log', {
      actionType: action,
      actionTarget: targetId,
      actionDetail: JSON.stringify(data),
      userId: operator.userId,
      userName: operator.userName,
      userRole: operator.userRole,
    });
  }
}
