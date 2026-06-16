import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  SecurityEvent,
  EventFlowTrail,
  PersonStayRecord,
  Person,
  Area,
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

    event.status = EventStatus.DISPATCHED;
    event.assignedTo = dto.assignedTo;
    event.dispatchedAt = new Date() as any;
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      event.status,
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

    event.status = EventStatus.PROCESSING;
    event.processingStartedAt = new Date();
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      EventStatus.DISPATCHED,
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
      event.status,
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
      event.status,
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

    event.status = EventStatus.CLOSED;
    event.closedAt = new Date();
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      event.status,
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

    event.status = EventStatus.FALSE_ALARM;
    event.falseAlarmCategory = dto.category;
    event.falseAlarmRemark = dto.remark;
    event.resolvedAt = new Date();
    event.resolvedBy = operator.userId;
    event.updatedBy = operator.userId;

    const saved = await this.eventRepo.save(event);

    await this.addFlowTrail(
      saved.id,
      event.status,
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

    let currentEvent: SecurityEvent | null = null;
    const sortedRecords = records.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    for (const record of sortedRecords) {
      if (record.durationSeconds === 0 && !record.endTime) continue;

      const matchedRule = await this.stayRuleService.matchRules(record.areaId, record.hospitalId);
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

      if (actualDuration < matchedRule.maxStaySeconds) {
        record.isProcessed = true;
        await this.stayRecordRepo.save(record);
        continue;
      }

      if (matchedRule.mergeSamePerson && currentEvent) {
        const lastDetected = new Date(currentEvent.lastDetectedAt);
        const recordStart = new Date(record.startTime);
        const timeDiff = Math.round((recordStart.getTime() - lastDetected.getTime()) / 1000);

        if (timeDiff <= matchedRule.mergeTimeWindowSeconds) {
          await this.mergeRecordIntoEvent(currentEvent, record, actualDuration);
          record.isMerged = true;
          record.mergedIntoEventId = currentEvent.id;
          record.isProcessed = true;
          await this.stayRecordRepo.save(record);
          merged++;
          continue;
        }
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
  ): Promise<void> {
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

    return this.createEvent(dto, { userId: 'system', userName: '系统', userRole: 'system' });
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
