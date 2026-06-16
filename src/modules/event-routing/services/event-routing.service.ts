import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  SecurityEvent,
  EventFlowTrail,
  PersonStayRecord,
  Person,
  Area,
  EventNotification,
} from '../../../infrastructure/entities';
import {
  QueryEventDto,
  DispatchEventDto,
  EscalateEventDto,
  ProcessEventDto,
  ResolveEventDto,
  CloseEventDto,
  MarkFalseAlarmDto,
  CreateEventDto,
} from '../dto/event.dto';
import { PaginationDto, PaginatedResultDto } from '../../../common/dto/common.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventStatus, EventLevel } from '../../../common/enums';
import { StayRuleService } from '../../../modules/rule-orchestration/services/stay-rule.service';
import { v4 as uuidv4 } from 'uuid';
import * as dayjs from 'dayjs';

@Injectable()
export class EventRoutingService {
  private readonly logger = new Logger(EventRoutingService.name);

  constructor(
    @InjectRepository(SecurityEvent) private readonly eventRepo: Repository<SecurityEvent>,
    @InjectRepository(EventFlowTrail) private readonly flowTrailRepo: Repository<EventFlowTrail>,
    @InjectRepository(EventNotification) private readonly notificationRepo: Repository<EventNotification>,
    @InjectRepository(PersonStayRecord) private readonly stayRecordRepo: Repository<PersonStayRecord>,
    @InjectRepository(Person) private readonly personRepo: Repository<Person>,
    @InjectRepository(Area) private readonly areaRepo: Repository<Area>,
    private readonly stayRuleService: StayRuleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  generateEventNo(): string {
    const now = dayjs();
    return `EVT${now.format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  async createEvent(dto: CreateEventDto, operator: any): Promise<SecurityEvent> {
    const event = this.eventRepo.create({
      ...dto,
      eventNo: this.generateEventNo(),
      status: EventStatus.PENDING,
      firstDetectedAt: dto.stayTimeline?.[0]?.startTime || new Date(),
      lastDetectedAt: dto.stayTimeline?.[dto.stayTimeline.length - 1]?.endTime || new Date(),
      isKeyFocus: false,
      createdBy: operator?.userId || 'system',
      updatedBy: operator?.userId || 'system',
    });

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(saved.id, null, EventStatus.PENDING, 'event.create', '事件自动生成', operator);
    this.eventEmitter.emit('event.created', { eventId: saved.id, eventNo: saved.eventNo });

    return saved;
  }

  async findEventById(id: string): Promise<SecurityEvent> {
    const event = await this.eventRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['person', 'flowTrails', 'notifications'],
    }) as SecurityEvent;
    if (!event) throw new NotFoundException(`事件不存在: ${id}`);
    return event;
  }

  async findEventByNo(eventNo: string): Promise<SecurityEvent> {
    const event = await this.eventRepo.findOne({
      where: { eventNo, isDeleted: false },
      relations: ['person', 'flowTrails', 'notifications'],
    }) as SecurityEvent;
    if (!event) throw new NotFoundException(`事件编号不存在: ${eventNo}`);
    return event;
  }

  async queryEvents(query: QueryEventDto, pagination: PaginationDto): Promise<PaginatedResultDto<SecurityEvent>> {
    const qb = this.eventRepo.createQueryBuilder('e').where('e.isDeleted = :isDeleted', { isDeleted: false });

    if (query.hospitalId) qb.andWhere('e.hospitalId = :hospitalId', { hospitalId: query.hospitalId });
    if (query.buildingId) qb.andWhere('e.buildingId = :buildingId', { buildingId: query.buildingId });
    if (query.floorId) qb.andWhere('e.floorId = :floorId', { floorId: query.floorId });
    if (query.areaId) qb.andWhere('e.initialAreaId = :areaId', { areaId: query.areaId });
    if (query.personId) qb.andWhere('e.personId = :personId', { personId: query.personId });
    if (query.eventLevel) qb.andWhere('e.eventLevel = :eventLevel', { eventLevel: query.eventLevel });
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.isKeyFocus !== undefined) qb.andWhere('e.isKeyFocus = :isKeyFocus', { isKeyFocus: query.isKeyFocus });
    if (query.startTimeFrom) qb.andWhere('e.firstDetectedAt >= :startTimeFrom', { startTimeFrom: query.startTimeFrom });
    if (query.startTimeTo) qb.andWhere('e.firstDetectedAt <= :startTimeTo', { startTimeTo: query.startTimeTo });
    if (query.keyword) {
      qb.andWhere('(e.title LIKE :keyword OR e.eventNo LIKE :keyword OR e.description LIKE :keyword)', {
        keyword: `%${query.keyword}%`,
      });
    }

    qb.orderBy('e.isKeyFocus', 'DESC')
      .addOrderBy('CASE e.eventLevel WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END', 'ASC')
      .addOrderBy('e.firstDetectedAt', 'DESC')
      .leftJoinAndSelect('e.person', 'person')
      .skip((pagination.page - 1) * pagination.pageSize)
      .take(pagination.pageSize);

    const [list, total] = await qb.getManyAndCount();
    return PaginatedResultDto.create(list, total, pagination.page, pagination.pageSize);
  }

  async dispatchEvent(id: string, dto: DispatchEventDto, operator: any): Promise<SecurityEvent> {
    const event = await this.findEventById(id);
    const allowedFrom = [EventStatus.PENDING, EventStatus.DISPATCHED];
    if (!allowedFrom.includes(event.status as any)) {
      throw new BadRequestException(`当前状态 ${event.status} 不允许派单`);
    }

    const fromStatus = event.status;
    event.status = EventStatus.DISPATCHED;
    event.assignedTo = dto.assignedTo;
    event.dispatchedAt = new Date() as any;
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      fromStatus,
      EventStatus.DISPATCHED,
      'event.dispatch',
      dto.remark || `派单给: ${dto.assignedToName || dto.assignedTo}`,
      operator,
      dto.assignedTo,
      dto.assignedToName,
    );

    this.eventEmitter.emit('event.dispatched', {
      eventId: saved.id,
      assignedTo: dto.assignedTo,
      notificationTargets: dto.notificationTargets,
    });

    return saved;
  }

  async startProcessing(id: string, dto: ProcessEventDto, operator: any): Promise<SecurityEvent> {
    const event = await this.findEventById(id);
    const allowedFrom = [EventStatus.DISPATCHED];
    if (!allowedFrom.includes(event.status as any)) {
      throw new BadRequestException(`当前状态 ${event.status} 不允许开始处置`);
    }

    const fromStatus = event.status;
    event.status = EventStatus.PROCESSING;
    event.processingStartedAt = new Date();
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      fromStatus,
      EventStatus.PROCESSING,
      'event.start_processing',
      dto.remark || '开始处置',
      operator,
    );

    return saved;
  }

  async escalateEvent(id: string, dto: EscalateEventDto, operator: any): Promise<SecurityEvent> {
    const event = await this.findEventById(id);
    const allowedFrom = [EventStatus.PENDING, EventStatus.DISPATCHED, EventStatus.PROCESSING];
    if (!allowedFrom.includes(event.status as any)) {
      throw new BadRequestException(`当前状态 ${event.status} 不允许升级`);
    }

    const fromStatus = event.status;
    event.isKeyFocus = true;
    event.keyFocusReason = dto.reason;
    event.escalatedAt = new Date();
    event.escalatedBy = operator.userId;
    if (dto.targetLevel) {
      event.eventLevel = dto.targetLevel;
    } else if (event.eventLevel === EventLevel.LOW || event.eventLevel === EventLevel.MEDIUM) {
      event.eventLevel = EventLevel.HIGH;
    }
    event.status = EventStatus.ESCALATED;
    if (dto.assignedTo) {
      event.assignedTo = dto.assignedTo;
    }
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      fromStatus,
      EventStatus.ESCALATED,
      'event.escalate',
      `升级为重点关注: ${dto.reason}`,
      operator,
      dto.assignedTo,
      dto.assignedToName,
    );

    this.eventEmitter.emit('event.escalated', {
      eventId: saved.id,
      reason: dto.reason,
      targetLevel: saved.eventLevel,
    });

    return saved;
  }

  async resolveEvent(id: string, dto: ResolveEventDto, operator: any): Promise<SecurityEvent> {
    const event = await this.findEventById(id);
    const allowedFrom = [EventStatus.PROCESSING, EventStatus.ESCALATED];
    if (!allowedFrom.includes(event.status as any)) {
      throw new BadRequestException(`当前状态 ${event.status} 不允许标记已处置`);
    }

    const fromStatus = event.status;
    event.status = EventStatus.RESOLVED;
    event.resolvedAt = new Date();
    event.resolvedBy = operator.userId;
    event.dispositionRemark = dto.remark;

    if (event.processingStartedAt) {
      event.handlingDurationSeconds = Math.round(
        (new Date().getTime() - new Date(event.processingStartedAt).getTime()) / 1000,
      );
    }

    event.updatedBy = operator.userId;
    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      fromStatus,
      EventStatus.RESOLVED,
      'event.resolve',
      dto.remark,
      operator,
    );

    this.eventEmitter.emit('event.resolved', { eventId: saved.id });
    return saved;
  }

  async closeEvent(id: string, dto: CloseEventDto, operator: any): Promise<SecurityEvent> {
    const event = await this.findEventById(id);
    const allowedFrom = [EventStatus.RESOLVED, EventStatus.FALSE_ALARM];
    if (!allowedFrom.includes(event.status as any)) {
      throw new BadRequestException(`当前状态 ${event.status} 不允许关闭`);
    }

    const fromStatus = event.status;
    event.status = EventStatus.CLOSED;
    event.closedAt = new Date();
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      fromStatus,
      EventStatus.CLOSED,
      'event.close',
      dto.remark || '事件关闭',
      operator,
    );

    this.eventEmitter.emit('event.closed', { eventId: saved.id });
    return saved;
  }

  async markFalseAlarm(id: string, dto: MarkFalseAlarmDto, operator: any): Promise<SecurityEvent> {
    const event = await this.findEventById(id);
    const allowedFrom = [EventStatus.PENDING, EventStatus.DISPATCHED, EventStatus.PROCESSING, EventStatus.ESCALATED];
    if (!allowedFrom.includes(event.status as any)) {
      throw new BadRequestException(`当前状态 ${event.status} 不允许标记误报`);
    }

    const fromStatus = event.status;
    event.status = EventStatus.FALSE_ALARM;
    event.falseAlarmCategory = dto.category;
    event.falseAlarmRemark = dto.remark;
    event.resolvedAt = new Date();
    event.resolvedBy = operator.userId;
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      fromStatus,
      EventStatus.FALSE_ALARM,
      'event.false_alarm',
      `误报分类: ${dto.category}, 说明: ${dto.remark}`,
      operator,
    );

    this.eventEmitter.emit('event.false_alarm', {
      eventId: saved.id,
      category: dto.category,
      hospitalId: saved.hospitalId,
    });

    return saved;
  }

  async processStayRecords(): Promise<{ created: number; merged: number }> {
    this.logger.log('开始处理停留记录生成事件...');
    let createdCount = 0;
    let mergedCount = 0;

    const unprocessedRecords = await this.stayRecordRepo.find({
      where: { isProcessed: false },
      order: { startTime: 'ASC' },
    });

    const groupedByPerson = new Map<string, typeof unprocessedRecords>();
    for (const record of unprocessedRecords) {
      if (!groupedByPerson.has(record.personId)) {
        groupedByPerson.set(record.personId, []);
      }
      groupedByPerson.get(record.personId).push(record);
    }

    for (const [personId, records] of groupedByPerson) {
      const result = await this.processPersonRecords(personId, records);
      createdCount += result.created;
      mergedCount += result.merged;
    }

    this.logger.log(`处理完成: 创建事件 ${createdCount} 条, 合并 ${mergedCount} 条`);
    return { created: createdCount, merged: mergedCount };
  }

  private async processPersonRecords(
    personId: string,
    records: PersonStayRecord[],
  ): Promise<{ created: number; merged: number }> {
    let created = 0;
    let merged = 0;
    const person = await this.personRepo.findOneBy({ id: personId }) as Person;

    let currentEvent: SecurityEvent | null = await this.findActiveEventForPerson(personId);
    const sortedRecords = records.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    for (const record of sortedRecords) {
      if (record.durationSeconds === 0 && !record.endTime) continue;

      const matchedRule = await this.stayRuleService.matchRules(
        record.areaId,
        record.hospitalId,
        record.startTime,
      );
      if (!matchedRule) {
        record.isProcessed = true;
        await this.stayRecordRepo.save(record);
        continue;
      }

      const actualDuration = record.durationSeconds > 0
        ? record.durationSeconds
        : record.endTime
          ? Math.round((new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 1000)
          : Math.round((Date.now() - new Date(record.startTime).getTime()) / 1000);

      const durationExceeded = actualDuration >= matchedRule.maxStaySeconds;

      if (matchedRule.mergeSamePerson && currentEvent) {
        const lastDetected = new Date(currentEvent.lastDetectedAt);
        const recordStart = new Date(record.startTime);
        const timeDiff = Math.round((recordStart.getTime() - lastDetected.getTime()) / 1000);

        if (timeDiff <= matchedRule.mergeTimeWindowSeconds) {
          await this.mergeRecordIntoEvent(currentEvent, record, actualDuration, matchedRule);
          record.isMerged = true;
          record.mergedIntoEventId = currentEvent.id;
          record.isProcessed = true;
          await this.stayRecordRepo.save(record);
          merged++;
          continue;
        }
      }

      if (!durationExceeded) {
        record.isProcessed = true;
        await this.stayRecordRepo.save(record);
        continue;
      }

      currentEvent = await this.createEventFromRecord(record, person, matchedRule, actualDuration);
      record.isMerged = false;
      record.mergedIntoEventId = currentEvent.id;
      record.isProcessed = true;
      await this.stayRecordRepo.save(record);
      created++;
    }

    return { created, merged };
  }

  private async mergeRecordIntoEvent(
    event: SecurityEvent,
    record: PersonStayRecord,
    duration: number,
    matchedRule?: any,
  ): Promise<void> {
    const area = await this.areaRepo.findOneBy({ id: record.areaId }) as Area;
    const areaSet = new Set(event.involvedAreaIds);
    areaSet.add(record.areaId);
    event.involvedAreaIds = Array.from(areaSet);

    const deviceSet = new Set(event.involvedDeviceIds);
    deviceSet.add(record.deviceId);
    event.involvedDeviceIds = Array.from(deviceSet);

    event.lastDetectedAt = record.endTime || new Date();
    event.totalDurationSeconds += duration;
    event.areaChangeCount = event.involvedAreaIds.length - 1;

    if (event.stayTimeline) {
      event.stayTimeline.push({
        recordId: record.id,
        areaId: record.areaId,
        deviceId: record.deviceId,
        startTime: record.startTime,
        endTime: record.endTime || new Date(),
        durationSeconds: duration,
      });
    }

    if (record.snapshots && record.snapshots.length > 0 && event.snapshots) {
      event.snapshots = [...event.snapshots, ...record.snapshots].slice(-10);
    }

    const extra = (event.extraData as any) || {};
    if (extra.analysisSummary) {
      extra.analysisSummary.mergedSegments = extra.analysisSummary.mergedSegments || [];
      extra.analysisSummary.mergedSegments.push({
        recordId: record.id,
        areaId: record.areaId,
        areaName: area?.name,
        deviceId: record.deviceId,
        startTime: record.startTime,
        endTime: record.endTime || new Date(),
        durationSeconds: duration,
        isTriggerSegment: false,
        thresholdAtTime: matchedRule?.maxStaySeconds,
        mergedAt: new Date(),
      });
      extra.analysisSummary.threshold.actualDurationSeconds = event.totalDurationSeconds;
      extra.analysisSummary.threshold.exceededBySeconds = event.totalDurationSeconds - extra.analysisSummary.threshold.effectiveMaxStaySeconds;
      extra.analysisSummary.updatedAt = new Date();
      event.extraData = extra as any;
    }

    await this.eventRepo.save(event);

    this.eventEmitter.emit('event.merged', {
      eventId: event.id,
      addedAreaId: record.areaId,
      addedDuration: duration,
    });
  }

  private async createEventFromRecord(
    record: PersonStayRecord,
    person: Person | null,
    matchedRule: any,
    duration: number,
  ): Promise<SecurityEvent> {
    const area = await this.areaRepo.findOneBy({ id: record.areaId }) as Area;
    const sceneName = this.getSceneName(area?.sceneType);

    const title = person
      ? `人员 ${person.name} 在${sceneName}区域异常滞留 ${Math.round(duration / 60)} 分钟`
      : `检测到${sceneName}区域异常滞留 ${Math.round(duration / 60)} 分钟`;

    const analysisSummary = this.buildAnalysisSummary(
      matchedRule,
      record.startTime,
      duration,
      [{
        recordId: record.id,
        areaId: record.areaId,
        areaName: area?.name,
        deviceId: record.deviceId,
        startTime: record.startTime,
        endTime: record.endTime || new Date(),
        durationSeconds: duration,
        isTriggerSegment: true,
        thresholdAtTime: matchedRule.maxStaySeconds,
      }],
    );

    const dto: CreateEventDto = {
      hospitalId: record.hospitalId,
      buildingId: record.buildingId,
      floorId: record.floorId,
      initialAreaId: record.areaId,
      involvedAreaIds: [record.areaId],
      involvedDeviceIds: [record.deviceId],
      personId: person?.id,
      eventLevel: matchedRule.eventLevel,
      title,
      description: `区域: ${area?.name}, 时长: ${Math.round(duration / 60)}分钟, 触发规则: ${matchedRule.ruleName}`,
      matchedRuleId: matchedRule.ruleId,
      matchedRuleName: matchedRule.ruleName,
      totalDurationSeconds: duration,
      stayTimeline: [
        {
          recordId: record.id,
          areaId: record.areaId,
          deviceId: record.deviceId,
          startTime: record.startTime,
          endTime: record.endTime || new Date(),
          durationSeconds: duration,
        },
      ],
      snapshots: record.snapshots,
      strictModeTriggered: matchedRule.isStrictModeApplied,
    };

    const created = await this.createEvent(dto, { userId: 'system', userName: '系统', userRole: 'system' });
    created.extraData = { analysisSummary } as any;
    return (await this.eventRepo.save(created)) as unknown as SecurityEvent;
  }

  private buildAnalysisSummary(
    matchedRule: any,
    eventStartTime: Date,
    totalDuration: number,
    segments: Array<any>,
  ): any {
    return {
      generatedAt: new Date(),
      triggerRule: {
        ruleId: matchedRule.ruleId,
        ruleName: matchedRule.ruleName,
        baseMaxStaySeconds: matchedRule._baseMaxStaySeconds || matchedRule.maxStaySeconds,
        baseEventLevel: matchedRule._baseEventLevel || matchedRule.eventLevel,
      },
      timeSlotMatch: {
        atTime: eventStartTime,
        weekday: new Date(eventStartTime).getDay(),
        timeOfDay: new Date(eventStartTime).toTimeString().slice(0, 5),
        sensitivityApplied: matchedRule.sensitivity,
        matchedSlot: matchedRule._matchedSlot || null,
      },
      threshold: {
        effectiveMaxStaySeconds: matchedRule.maxStaySeconds,
        warningStaySeconds: matchedRule.warningStaySeconds,
        actualDurationSeconds: totalDuration,
        exceededBySeconds: totalDuration - matchedRule.maxStaySeconds,
      },
      strictModeImpact: {
        applied: matchedRule.isStrictModeApplied || false,
        sensitivityMultiplier: matchedRule._strictMultiplier || null,
        thresholdReducedBy: (matchedRule._baseMaxStaySeconds && matchedRule._baseMaxStaySeconds !== matchedRule.maxStaySeconds)
          ? matchedRule._baseMaxStaySeconds - matchedRule.maxStaySeconds
          : 0,
        levelElevated: (matchedRule._baseEventLevel && matchedRule._baseEventLevel !== matchedRule.eventLevel) || false,
      },
      finalDecision: {
        eventLevel: matchedRule.eventLevel,
        notificationTargets: matchedRule.notificationTargets,
        mergeSamePerson: matchedRule.mergeSamePerson,
        mergeTimeWindowSeconds: matchedRule.mergeTimeWindowSeconds,
      },
      mergedSegments: segments,
    };
  }

  async getEventAnalysis(id: string): Promise<any> {
    const event = await this.findEventById(id);
    const extra = (event.extraData as any) || {};

    let flowTrails: EventFlowTrail[] = [];
    try {
      flowTrails = await this.getEventFlowTrails(id);
    } catch (e) {
      this.logger.warn(`获取事件 ${id} 流转轨迹失败: ${e.message}`);
    }

    let notifications: EventNotification[] = [];
    try {
      notifications = await this.notificationRepo.find({
        where: { eventId: id, isDeleted: false },
        order: { createdAt: 'ASC' as any },
      }) as EventNotification[];
    } catch (e) {
      this.logger.warn(`获取事件 ${id} 通知记录失败: ${e.message}`);
    }

    const timelineWithType = this.decorateTimeline(event);

    return {
      eventBasic: {
        id: event.id,
        eventNo: event.eventNo,
        title: event.title,
        level: event.eventLevel,
        status: event.status,
        personId: event.personId,
        totalDurationSeconds: event.totalDurationSeconds,
        areaChangeCount: event.areaChangeCount,
        involvedAreaIds: event.involvedAreaIds,
        involvedDeviceIds: event.involvedDeviceIds,
        createdAt: event.createdAt,
        firstDetectedAt: event.firstDetectedAt,
        lastDetectedAt: event.lastDetectedAt,
        isKeyFocus: event.isKeyFocus,
        strictModeTriggered: event.strictModeTriggered,
      },
      analysisSummary: extra.analysisSummary || null,
      stayTimeline: timelineWithType,
      flowTrails,
      notifications: notifications || [],
      currentStage: this.getCurrentStage(event),
    };
  }

  async exportEventReview(id: string): Promise<any> {
    const event = await this.findEventById(id);
    const analysis = await this.getEventAnalysis(id);
    const extra = (event.extraData as any) || {};

    const finalConclusion = this.buildFinalConclusion(event, analysis);

    return {
      exportMeta: {
        exportedAt: new Date(),
        eventNo: event.eventNo,
        title: event.title,
      },
      overview: {
        eventNo: event.eventNo,
        title: event.title,
        level: event.eventLevel,
        status: event.status,
        hospitalId: event.hospitalId,
        personId: event.personId,
        totalDurationMinutes: Math.round(event.totalDurationSeconds / 60),
        areaCount: event.involvedAreaIds.length,
        areaChangeCount: event.areaChangeCount,
        firstDetectedAt: event.firstDetectedAt,
        lastDetectedAt: event.lastDetectedAt,
        isKeyFocus: event.isKeyFocus,
        strictModeTriggered: event.strictModeTriggered,
      },
      triggerAnalysis: extra.analysisSummary || null,
      stayTimeline: analysis.stayTimeline,
      notifications: analysis.notifications.map((n: any) => ({
        targetType: n.targetType,
        targetName: n.targetName,
        channel: n.channel,
        title: n.title,
        sentAt: n.sentAt,
        isRead: n.isRead,
        sendSuccess: n.sendSuccess,
      })),
      dispositionTrail: analysis.flowTrails.map((t: any) => ({
        actionType: t.actionType,
        fromStatus: t.fromStatus,
        toStatus: t.toStatus,
        operatorName: t.operatorName,
        remark: t.remark,
        assignedToName: t.assignedToName,
        occurredAt: t.createdAt,
      })),
      finalConclusion,
    };
  }

  async getEventAnalysisByNo(eventNo: string): Promise<any> {
    const event = await this.findEventByNo(eventNo);
    return this.getEventAnalysis(event.id);
  }

  async exportEventReviewByNo(eventNo: string): Promise<any> {
    const event = await this.findEventByNo(eventNo);
    return this.exportEventReview(event.id);
  }

  async getReviewReport(
    hospitalId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    let qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });

    if (hospitalId) {
      qb = qb.andWhere('e.hospitalId = :hospitalId', { hospitalId });
    }
    if (startDate) {
      qb = qb.andWhere('e.first_detected_at >= :startDate', { startDate });
    }
    if (endDate) {
      qb = qb.andWhere('e.first_detected_at <= :endDate', { endDate });
    }

    const events = await qb.orderBy('e.first_detected_at', 'DESC').getMany();
    const total = events.length;

    const byLevel: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byRule: Record<string, { count: number; ruleName: string }> = {};
    const byScene: Record<string, number> = {};
    const strictTriggeredCount = events.filter(e => e.strictModeTriggered).length;
    const keyFocusCount = events.filter(e => e.isKeyFocus).length;
    const falseAlarmCount = events.filter(e => e.status === EventStatus.FALSE_ALARM).length;

    let totalDuration = 0;

    for (const evt of events) {
      byLevel[evt.eventLevel] = (byLevel[evt.eventLevel] || 0) + 1;
      byStatus[evt.status] = (byStatus[evt.status] || 0) + 1;
      if (evt.matchedRuleId) {
        if (!byRule[evt.matchedRuleId]) {
          byRule[evt.matchedRuleId] = { count: 0, ruleName: evt.matchedRuleName || '未知规则' };
        }
        byRule[evt.matchedRuleId].count++;
      }
      totalDuration += evt.totalDurationSeconds || 0;
    }

    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

    const eventSummaries = events.map(e => {
      const stage = this.getCurrentStage(e);
      return {
        id: e.id,
        eventNo: e.eventNo,
        title: e.title,
        level: e.eventLevel,
        status: e.status,
        matchedRuleId: e.matchedRuleId,
        matchedRuleName: e.matchedRuleName,
        totalDurationSeconds: e.totalDurationSeconds,
        areaChangeCount: e.areaChangeCount,
        isKeyFocus: e.isKeyFocus,
        strictModeTriggered: e.strictModeTriggered,
        firstDetectedAt: e.firstDetectedAt,
        lastDetectedAt: e.lastDetectedAt,
        closedAt: e.resolvedAt || (e as any).closedAt || null,
        assignedTo: e.assignedToName || e.assignedTo,
        currentStage: stage,
      };
    });

    return {
      reportMeta: {
        generatedAt: new Date(),
        hospitalId: hospitalId || 'all',
        startDate,
        endDate,
        totalEvents: total,
      },
      summaryStats: {
        total,
        strictTriggered: strictTriggeredCount,
        keyFocus: keyFocusCount,
        falseAlarmCount,
        falseAlarmRate: total > 0 ? +(falseAlarmCount / total * 100).toFixed(2) : 0,
        avgDurationSeconds: avgDuration,
        avgDurationMinutes: Math.round(avgDuration / 60),
      },
      byLevel,
      byStatus,
      byRule: Object.entries(byRule).map(([id, info]) => ({
        ruleId: id,
        ruleName: info.ruleName,
        count: info.count,
      })).sort((a, b) => b.count - a.count),
      eventSummaries,
    };
  }

  async getSupervisionStats(
    hospitalId?: string,
    dispatchTimeoutMinutes = 30,
    processTimeoutMinutes = 120,
  ): Promise<any> {
    let qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('e.status NOT IN (:...closedStatuses)', {
        closedStatuses: [EventStatus.CLOSED, EventStatus.RESOLVED, EventStatus.FALSE_ALARM],
      });

    if (hospitalId) {
      qb = qb.andWhere('e.hospitalId = :hospitalId', { hospitalId });
    }

    const events = await qb.getMany();

    const byStage: Record<string, { count: number; stageText: string; timeoutCount: number }> = {
      pending_dispatch: { count: 0, stageText: '待派单', timeoutCount: 0 },
      pending_process: { count: 0, stageText: '待处置', timeoutCount: 0 },
      processing: { count: 0, stageText: '处置中', timeoutCount: 0 },
      escalated: { count: 0, stageText: '已升级重点关注', timeoutCount: 0 },
    };

    const byAssignee: Record<string, {
      assignee: string;
      assigneeName: string;
      total: number;
      pendingDispatch: number;
      pendingProcess: number;
      processing: number;
      escalated: number;
      timeoutCount: number;
      maxStuckMinutes: number;
    }> = {};

    const now = Date.now();

    for (const evt of events) {
      const stage = this.getCurrentStage(evt);
      const stageKey = stage.stage;

      if (byStage[stageKey]) {
        byStage[stageKey].count++;
        const isTimeout = (stage.stuckMinutes || 0) >=
          (stageKey === 'pending_dispatch' ? dispatchTimeoutMinutes : processTimeoutMinutes);
        if (isTimeout) byStage[stageKey].timeoutCount++;
      }

      const assignee = evt.assignedTo || 'unassigned';
      const assigneeName = evt.assignedToName || '未指派';
      if (!byAssignee[assignee]) {
        byAssignee[assignee] = {
          assignee,
          assigneeName,
          total: 0,
          pendingDispatch: 0,
          pendingProcess: 0,
          processing: 0,
          escalated: 0,
          timeoutCount: 0,
          maxStuckMinutes: 0,
        };
      }
      byAssignee[assignee].total++;
      const stuckMin = stage.stuckMinutes || 0;
      if (stuckMin > byAssignee[assignee].maxStuckMinutes) {
        byAssignee[assignee].maxStuckMinutes = stuckMin;
      }

      const isTimeout =
        (stageKey === 'pending_dispatch' && stuckMin >= dispatchTimeoutMinutes) ||
        (stageKey !== 'pending_dispatch' && stageKey !== 'unknown' && stuckMin >= processTimeoutMinutes);
      if (isTimeout) byAssignee[assignee].timeoutCount++;

      switch (stageKey) {
        case 'pending_dispatch': byAssignee[assignee].pendingDispatch++; break;
        case 'pending_process': byAssignee[assignee].pendingProcess++; break;
        case 'processing': byAssignee[assignee].processing++; break;
        case 'escalated': byAssignee[assignee].escalated++; break;
      }
    }

    const assigneeList = Object.values(byAssignee).sort((a, b) => b.total - a.total);

    return {
      totalOpen: events.length,
      dispatchTimeoutMinutes,
      processTimeoutMinutes,
      byStage,
      byAssignee: assigneeList,
      totalTimeout: Object.values(byStage).reduce((sum, s) => sum + s.timeoutCount, 0),
    };
  }

  async getAssigneeEventList(
    assignee: string,
    hospitalId?: string,
    pagination?: PaginationDto,
  ): Promise<any> {
    let qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('e.status NOT IN (:...closedStatuses)', {
        closedStatuses: [EventStatus.CLOSED, EventStatus.RESOLVED, EventStatus.FALSE_ALARM],
      });

    if (assignee === 'unassigned') {
      qb = qb.andWhere('(e.assigned_to IS NULL OR e.assigned_to = "")');
    } else {
      qb = qb.andWhere('e.assigned_to = :assignee', { assignee });
    }

    if (hospitalId) {
      qb = qb.andWhere('e.hospital_id = :hospitalId', { hospitalId });
    }

    const total = await qb.getCount();

    if (pagination) {
      const page = pagination.page || 1;
      const pageSize = pagination.pageSize || 20;
      qb = qb.orderBy('e.created_at', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    }

    const events = await qb.getMany();
    const list = events.map(e => {
      const stage = this.getCurrentStage(e);
      return {
        id: e.id,
        eventNo: e.eventNo,
        title: e.title,
        level: e.eventLevel,
        status: e.status,
        isKeyFocus: e.isKeyFocus,
        strictModeTriggered: e.strictModeTriggered,
        firstDetectedAt: e.firstDetectedAt,
        totalDurationSeconds: e.totalDurationSeconds,
        currentStage: stage,
      };
    });

    return { total, assignee, list };
  }

  private buildFinalConclusion(event: SecurityEvent, analysis: any): any {
    const flowTrails = analysis.flowTrails || [];
    const notifications = analysis.notifications || [];
    const isClosed = [
      EventStatus.CLOSED, EventStatus.RESOLVED, EventStatus.FALSE_ALARM,
    ].includes(event.status as any);

    return {
      isClosed,
      closeStatus: event.status,
      dispositionResult: event.dispositionRemark || null,
      falseAlarmCategory: event.falseAlarmCategory || null,
      falseAlarmRemark: event.falseAlarmRemark || null,
      dispatched: event.dispatchedAt ? true : false,
      dispatchedAt: event.dispatchedAt,
      assignedTo: event.assignedToName || event.assignedTo,
      processingDurationMinutes: event.resolvedAt && event.dispatchedAt
        ? Math.round((new Date(event.resolvedAt).getTime() - new Date(event.dispatchedAt).getTime()) / 60000)
        : null,
      notificationCount: notifications.length,
      trailCount: flowTrails.length,
      closedAt: event.resolvedAt || event.closedAt || null,
      closedBy: event.updatedBy,
    };
  }

  private decorateTimeline(event: SecurityEvent): any[] {
    if (!event.stayTimeline || event.stayTimeline.length === 0) return [];
    const extra = (event.extraData as any) || {};
    const summary = extra.analysisSummary || null;
    const segments = summary?.mergedSegments || [];
    const recordIdToType: Record<string, string> = {};
    for (const seg of segments) {
      recordIdToType[seg.recordId] = seg.isTriggerSegment ? 'trigger' : 'supplement';
    }
    return event.stayTimeline.map((item: any, idx: number) => ({
      ...item,
      segmentType: idx === 0 ? 'trigger' : (recordIdToType[item.recordId] || 'supplement'),
      durationMinutes: Math.round(item.durationSeconds / 60),
    }));
  }

  private getCurrentStage(event: SecurityEvent): { stage: string; stageText: string; stuckSeconds?: number; stuckMinutes?: number } {
    const now = Date.now();
    let stage = 'unknown';
    let stageText = '未知';
    let refTime: Date | null = null;

    switch (event.status) {
      case EventStatus.PENDING:
        stage = 'pending_dispatch';
        stageText = '待派单';
        refTime = event.createdAt;
        break;
      case EventStatus.DISPATCHED:
        stage = 'pending_process';
        stageText = '待处置';
        refTime = event.dispatchedAt as any;
        break;
      case EventStatus.PROCESSING:
        stage = 'processing';
        stageText = '处置中';
        refTime = event.processingStartedAt;
        break;
      case EventStatus.ESCALATED:
        stage = 'escalated';
        stageText = '已升级重点关注';
        refTime = event.escalatedAt;
        break;
      case EventStatus.RESOLVED:
        stage = 'resolved';
        stageText = '已处置';
        break;
      case EventStatus.CLOSED:
        stage = 'closed';
        stageText = '已关闭';
        break;
      case EventStatus.FALSE_ALARM:
        stage = 'false_alarm';
        stageText = '误报';
        break;
      default:
        break;
    }

    const result: any = { stage, stageText };
    if (refTime) {
      result.stuckSeconds = Math.round((now - new Date(refTime).getTime()) / 1000);
      result.stuckMinutes = Math.round(result.stuckSeconds / 60);
    }
    return result;
  }

  async getSupervisionList(
    hospitalId?: string,
    viewType: 'all' | 'pending_dispatch_timeout' | 'process_timeout' | 'strict_unclosed' = 'all',
    dispatchTimeoutMinutes = 30,
    processTimeoutMinutes = 120,
    pagination?: PaginationDto,
  ): Promise<any> {
    let qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });

    if (hospitalId) {
      qb = qb.andWhere('e.hospitalId = :hospitalId', { hospitalId });
    }

    switch (viewType) {
      case 'pending_dispatch_timeout':
        qb = qb.andWhere('e.status = :st', { st: EventStatus.PENDING })
          .andWhere(`(julianday('now') - julianday(e.created_at)) * 1440 >= :t`, { t: dispatchTimeoutMinutes });
        break;
      case 'process_timeout':
        qb = qb.andWhere('e.status IN (:...sts)', { sts: [EventStatus.DISPATCHED, EventStatus.PROCESSING] })
          .andWhere(`(julianday('now') - julianday(COALESCE(e.dispatched_at, e.created_at))) * 1440 >= :t`, { t: processTimeoutMinutes });
        break;
      case 'strict_unclosed':
        qb = qb.andWhere('e.strict_mode_triggered = 1')
          .andWhere('e.status NOT IN (:...sts)', { sts: [EventStatus.CLOSED, EventStatus.RESOLVED, EventStatus.FALSE_ALARM] });
        break;
      default:
        break;
    }

    const total = await qb.getCount();

    if (pagination) {
      const page = pagination.page || 1;
      const pageSize = pagination.pageSize || 20;
      qb = qb.orderBy('e.created_at', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    }

    const events = await qb.getMany();
    const list = events.map(e => {
      const stage = this.getCurrentStage(e);
      return {
        id: e.id,
        eventNo: e.eventNo,
        title: e.title,
        level: e.eventLevel,
        status: e.status,
        hospitalId: e.hospitalId,
        totalDurationSeconds: e.totalDurationSeconds,
        isKeyFocus: e.isKeyFocus,
        strictModeTriggered: e.strictModeTriggered,
        createdAt: e.createdAt,
        firstDetectedAt: e.firstDetectedAt,
        lastDetectedAt: e.lastDetectedAt,
        currentStage: stage,
      };
    });

    return { total, list, viewType, filters: { hospitalId, dispatchTimeoutMinutes, processTimeoutMinutes } };
  }

  async batchDispatchEvents(
    eventIds: string[],
    dto: DispatchEventDto,
    operator: any,
  ): Promise<{ succeeded: string[]; failed: Array<{ eventId: string; reason: string }> }> {
    const succeeded: string[] = [];
    const failed: Array<{ eventId: string; reason: string }> = [];

    for (const eventId of eventIds) {
      try {
        await this.dispatchEvent(eventId, dto, operator);
        succeeded.push(eventId);
      } catch (e: any) {
        failed.push({ eventId, reason: e.message || '处理失败' });
      }
    }

    return { succeeded, failed };
  }

  async batchCloseEvents(
    eventIds: string[],
    dto: CloseEventDto,
    operator: any,
  ): Promise<{ succeeded: string[]; failed: Array<{ eventId: string; reason: string }> }> {
    const succeeded: string[] = [];
    const failed: Array<{ eventId: string; reason: string }> = [];

    for (const eventId of eventIds) {
      try {
        await this.closeEvent(eventId, dto, operator);
        succeeded.push(eventId);
      } catch (e: any) {
        failed.push({ eventId, reason: e.message || '处理失败' });
      }
    }

    return { succeeded, failed };
  }

  private getSceneName(sceneType?: string): string {
    const sceneMap: Record<string, string> = {
      pediatrics: '儿科',
      emergency: '急诊',
      operating_room: '手术部',
      pharmacy: '药库',
      icu: 'ICU',
      nicu: 'NICU',
      ward: '病房',
      lobby: '大堂',
      parking: '停车场',
      other: '其他',
    };
    return sceneMap[sceneType || ''] || '监控';
  }

  async addFlowTrail(
    eventId: string,
    fromStatus: EventStatus | null,
    toStatus: EventStatus,
    actionType: string,
    remark: string,
    operator: any,
    assignedTo?: string,
    assignedToName?: string,
  ): Promise<EventFlowTrail> {
    if (fromStatus === toStatus) {
      this.logger.warn(`事件 ${eventId} 状态未变更，跳过轨迹记录: ${fromStatus} -> ${toStatus}`);
      return null as any;
    }

    const trail = this.flowTrailRepo.create({
      eventId,
      fromStatus,
      toStatus,
      actionType,
      remark,
      operatorId: operator?.userId,
      operatorName: operator?.userName,
      operatorRole: operator?.userRole,
      assignedTo,
      assignedToName,
    });
    return this.flowTrailRepo.save(trail);
  }

  private async findActiveEventForPerson(personId: string): Promise<SecurityEvent | null> {
    const activeStatuses = [
      EventStatus.PENDING,
      EventStatus.DISPATCHED,
      EventStatus.PROCESSING,
      EventStatus.ESCALATED,
    ];

    const events = await this.eventRepo.find({
      where: {
        personId,
        status: In(activeStatuses) as any,
        isDeleted: false,
      },
      order: { lastDetectedAt: 'DESC' },
      take: 1,
    });

    if (events && events.length > 0) {
      return events[0] as unknown as SecurityEvent;
    }
    return null;
  }

  async getEventFlowTrails(eventId: string): Promise<EventFlowTrail[]> {
    return this.flowTrailRepo.find({
      where: { eventId },
      order: { createdAt: 'ASC' },
    });
  }

  async getEventStats(hospitalId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    const qb = this.eventRepo.createQueryBuilder('e').where('e.isDeleted = :isDeleted', { isDeleted: false });
    if (hospitalId) qb.andWhere('e.hospitalId = :hospitalId', { hospitalId });
    if (startDate) qb.andWhere('e.firstDetectedAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('e.firstDetectedAt <= :endDate', { endDate });

    const total = await qb.getCount();

    const getCountByStatus = async (status: EventStatus) => {
      const countQb = this.eventRepo.createQueryBuilder('e').where('e.isDeleted = :isDeleted', { isDeleted: false });
      if (hospitalId) countQb.andWhere('e.hospitalId = :hospitalId', { hospitalId });
      if (startDate) countQb.andWhere('e.firstDetectedAt >= :startDate', { startDate });
      if (endDate) countQb.andWhere('e.firstDetectedAt <= :endDate', { endDate });
      countQb.andWhere('e.status = :status', { status });
      return countQb.getCount();
    };

    const getCountByLevel = async (level: EventLevel) => {
      const countQb = this.eventRepo.createQueryBuilder('e').where('e.isDeleted = :isDeleted', { isDeleted: false });
      if (hospitalId) countQb.andWhere('e.hospitalId = :hospitalId', { hospitalId });
      if (startDate) countQb.andWhere('e.firstDetectedAt >= :startDate', { startDate });
      if (endDate) countQb.andWhere('e.firstDetectedAt <= :endDate', { endDate });
      countQb.andWhere('e.eventLevel = :level', { level });
      return countQb.getCount();
    };

    const keyFocusQb = this.eventRepo.createQueryBuilder('e').where('e.isDeleted = :isDeleted AND e.isKeyFocus = 1', { isDeleted: false });
    if (hospitalId) keyFocusQb.andWhere('e.hospitalId = :hospitalId', { hospitalId });
    if (startDate) keyFocusQb.andWhere('e.firstDetectedAt >= :startDate', { startDate });
    if (endDate) keyFocusQb.andWhere('e.firstDetectedAt <= :endDate', { endDate });
    const keyFocusCount = await keyFocusQb.getCount();

    const avgHandlingQb = this.eventRepo
      .createQueryBuilder('e')
      .select('AVG(e.handlingDurationSeconds)', 'avg')
      .where('e.isDeleted = :isDeleted AND e.handlingDurationSeconds > 0', { isDeleted: false });
    if (hospitalId) avgHandlingQb.andWhere('e.hospitalId = :hospitalId', { hospitalId });
    if (startDate) avgHandlingQb.andWhere('e.firstDetectedAt >= :startDate', { startDate });
    if (endDate) avgHandlingQb.andWhere('e.firstDetectedAt <= :endDate', { endDate });
    const avgHandlingRaw = await avgHandlingQb.getRawOne();
    const avgHandlingSeconds = avgHandlingRaw?.avg ? Math.round(Number(avgHandlingRaw.avg)) : 0;

    return {
      total,
      pending: await getCountByStatus(EventStatus.PENDING),
      dispatched: await getCountByStatus(EventStatus.DISPATCHED),
      processing: await getCountByStatus(EventStatus.PROCESSING),
      escalated: await getCountByStatus(EventStatus.ESCALATED),
      resolved: await getCountByStatus(EventStatus.RESOLVED),
      falseAlarm: await getCountByStatus(EventStatus.FALSE_ALARM),
      closed: await getCountByStatus(EventStatus.CLOSED),
      critical: await getCountByLevel(EventLevel.CRITICAL),
      high: await getCountByLevel(EventLevel.HIGH),
      medium: await getCountByLevel(EventLevel.MEDIUM),
      low: await getCountByLevel(EventLevel.LOW),
      keyFocus: keyFocusCount,
      escalationRate: total > 0 ? Math.round((keyFocusCount / total) * 100) : 0,
      avgHandlingSeconds,
    };
  }
}
