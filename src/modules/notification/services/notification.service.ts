import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventNotification, SecurityEvent, StayRule } from '../../../infrastructure/entities';
import {
  CreateNotificationDto,
  BatchNotifyDto,
  QueryNotificationDto,
} from '../dto/notification.dto';
import { PaginationDto, PaginatedResultDto } from '../../../common/dto/common.dto';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationTarget, NotificationChannel, EventLevel } from '../../../common/enums';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private targetNameMap: Record<NotificationTarget, string> = {
    [NotificationTarget.MONITOR_ROOM]: '监控室',
    [NotificationTarget.PATROL]: '巡逻岗',
    [NotificationTarget.NURSE_STATION]: '护士站',
    [NotificationTarget.SECURITY_MANAGER]: '安保主管',
    [NotificationTarget.HOSPITAL_ADMIN]: '院区管理员',
    [NotificationTarget.GROUP_ADMIN]: '集团管理员',
  };

  constructor(
    @InjectRepository(EventNotification) private readonly notificationRepo: Repository<EventNotification>,
    @InjectRepository(SecurityEvent) private readonly eventRepo: Repository<SecurityEvent>,
    @InjectRepository(StayRule) private readonly ruleRepo: Repository<StayRule>,
  ) {}

  onModuleInit() {
    this.logger.log('通知服务已启动');
  }

  @OnEvent('event.created')
  async handleEventCreated(payload: { eventId: string }) {
    this.logger.log(`事件创建通知触发: ${payload.eventId}`);
    const event = await this.eventRepo.findOneBy({ id: payload.eventId }) as SecurityEvent;
    if (!event || !event.matchedRuleId) return;

    const rule = await this.ruleRepo.findOneBy({ id: event.matchedRuleId }) as StayRule;
    if (!rule) return;

    for (const targetType of rule.notificationTargets) {
      await this.createNotificationForTarget(
        event,
        targetType as NotificationTarget,
        this.getDefaultChannel(targetType as NotificationTarget, event.eventLevel),
      );
    }
  }

  @OnEvent('event.escalated')
  async handleEventEscalated(payload: { eventId: string; reason: string; targetLevel: EventLevel }) {
    this.logger.log(`事件升级通知触发: ${payload.eventId}`);
    const event = await this.eventRepo.findOneBy({ id: payload.eventId }) as SecurityEvent;
    if (!event) return;

    const extraTargets = [
      NotificationTarget.SECURITY_MANAGER,
      NotificationTarget.HOSPITAL_ADMIN,
    ];

    if (payload.targetLevel === EventLevel.CRITICAL) {
      extraTargets.push(NotificationTarget.GROUP_ADMIN);
    }

    for (const targetType of extraTargets) {
      await this.createNotificationForTarget(
        event,
        targetType,
        NotificationChannel.PLATFORM,
        `【重点关注】${payload.reason}`,
      );
    }
  }

  @OnEvent('event.dispatched')
  async handleEventDispatched(payload: { eventId: string; assignedTo?: string; notificationTargets?: string[] }) {
    this.logger.log(`事件派单通知触发: ${payload.eventId}`);
    const event = await this.eventRepo.findOneBy({ id: payload.eventId }) as SecurityEvent;
    if (!event) return;

    if (payload.notificationTargets && payload.notificationTargets.length > 0) {
      for (const targetType of payload.notificationTargets) {
        await this.createNotificationForTarget(
          event,
          targetType as NotificationTarget,
          NotificationChannel.PLATFORM,
          '【派单通知】请及时处置',
        );
      }
    }
  }

  private async createNotificationForTarget(
    event: SecurityEvent,
    targetType: NotificationTarget,
    channel: NotificationChannel,
    titlePrefix?: string,
  ): Promise<EventNotification> {
    const title = `${titlePrefix || this.getLevelLabel(event.eventLevel)}${event.title}`;
    const content = this.buildNotificationContent(event, targetType);

    const dto: CreateNotificationDto = {
      eventId: event.id,
      targetType,
      targetName: this.targetNameMap[targetType] || targetType,
      channel,
      title,
      content,
      extraPayload: {
        eventNo: event.eventNo,
        eventLevel: event.eventLevel,
        isKeyFocus: event.isKeyFocus,
      },
    };

    return this.createNotification(dto);
  }

  private getLevelLabel(level: EventLevel): string {
    const labels: Record<EventLevel, string> = {
      [EventLevel.LOW]: '【一般】',
      [EventLevel.MEDIUM]: '【注意】',
      [EventLevel.HIGH]: '【警告】',
      [EventLevel.CRITICAL]: '【紧急】',
    };
    return labels[level] || '';
  }

  private buildNotificationContent(event: SecurityEvent, targetType: NotificationTarget): string {
    const durationMin = Math.round(event.totalDurationSeconds / 60);
    let content = `事件编号: ${event.eventNo}\n`;
    content += `事件级别: ${this.getLevelLabel(event.eventLevel)}\n`;
    content += `异常描述: ${event.title}\n`;
    content += `停留时长: ${durationMin} 分钟\n`;
    content += `首次发现: ${event.firstDetectedAt}\n`;
    content += `涉及区域数: ${event.involvedAreaIds.length}\n`;

    switch (targetType) {
      case NotificationTarget.MONITOR_ROOM:
        content += `\n请监控室人员持续关注该区域画面，确认异常情况。`;
        break;
      case NotificationTarget.PATROL:
        content += `\n请巡逻人员立即前往现场核查，携带必要装备。`;
        break;
      case NotificationTarget.NURSE_STATION:
        content += `\n请护士站确认该区域是否有特殊情况，并配合安保工作。`;
        break;
      case NotificationTarget.SECURITY_MANAGER:
        content += `\n请安保主管协调处置资源，必要时升级处理。`;
        break;
      case NotificationTarget.HOSPITAL_ADMIN:
        content += `\n请院区管理员关注此安全事件进展。`;
        break;
      case NotificationTarget.GROUP_ADMIN:
        content += `\n请集团管理员关注此重点事件。`;
        break;
    }

    return content;
  }

  private getDefaultChannel(targetType: NotificationTarget, level: EventLevel): NotificationChannel {
    if (level === EventLevel.CRITICAL) return NotificationChannel.PHONE;
    if (level === EventLevel.HIGH) return NotificationChannel.SMS;
    return NotificationChannel.PLATFORM;
  }

  async createNotification(dto: CreateNotificationDto): Promise<EventNotification> {
    const notification = this.notificationRepo.create({
      ...dto,
      sentAt: new Date(),
      sendSuccess: true,
    });
    const saved = await this.notificationRepo.save(notification);

    this.logger.log(
      `通知已发送: ID=${saved.id}, 目标=${saved.targetType}(${saved.targetName}), 渠道=${saved.channel}`,
    );

    return saved;
  }

  async batchNotify(dto: BatchNotifyDto): Promise<EventNotification[]> {
    const results: EventNotification[] = [];
    for (const target of dto.targets) {
      const notification = await this.createNotification({
        eventId: dto.eventId,
        targetType: target.targetType,
        targetName: target.targetName || this.targetNameMap[target.targetType],
        targetUserId: target.targetUserId,
        channel: target.channel,
        title: dto.title,
        content: dto.contentTemplate,
        extraPayload: dto.extraPayload,
      });
      results.push(notification);
    }
    return results;
  }

  async findNotificationById(id: string): Promise<EventNotification> {
    const notification = await this.notificationRepo.findOneBy({ id }) as EventNotification;
    if (!notification) throw new NotFoundException(`通知不存在: ${id}`);
    return notification;
  }

  async queryNotifications(
    query: QueryNotificationDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResultDto<EventNotification>> {
    const qb = this.notificationRepo.createQueryBuilder('n');

    if (query.eventId) qb.andWhere('n.eventId = :eventId', { eventId: query.eventId });
    if (query.targetType) qb.andWhere('n.targetType = :targetType', { targetType: query.targetType });
    if (query.targetUserId) qb.andWhere('n.targetUserId = :targetUserId', { targetUserId: query.targetUserId });
    if (query.channel) qb.andWhere('n.channel = :channel', { channel: query.channel });
    if (query.isRead !== undefined) qb.andWhere('n.isRead = :isRead', { isRead: query.isRead });
    if (query.sendSuccess !== undefined) qb.andWhere('n.sendSuccess = :sendSuccess', { sendSuccess: query.sendSuccess });

    qb.orderBy('n.createdAt', 'DESC')
      .skip((pagination.page - 1) * pagination.pageSize)
      .take(pagination.pageSize);

    const [list, total] = await qb.getManyAndCount();
    return PaginatedResultDto.create(list, total, pagination.page, pagination.pageSize);
  }

  async markAsRead(id: string): Promise<EventNotification> {
    const notification = await this.findNotificationById(id);
    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(targetUserId: string): Promise<number> {
    const result = await this.notificationRepo.update(
      { targetUserId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected || 0;
  }

  async getNotificationStats(targetUserId?: string, targetType?: NotificationTarget): Promise<any> {
    const qb = this.notificationRepo.createQueryBuilder('n');
    if (targetUserId) qb.where('n.targetUserId = :targetUserId', { targetUserId });
    if (targetType) qb.andWhere('n.targetType = :targetType', { targetType });

    const total = await qb.getCount();
    const unreadQb = this.notificationRepo.createQueryBuilder('n');
    if (targetUserId) unreadQb.where('n.targetUserId = :targetUserId AND n.isRead = 0', { targetUserId });
    if (targetType) unreadQb.andWhere('n.targetType = :targetType', { targetType });
    const unread = await unreadQb.getCount();

    return { total, unread };
  }

  async retryNotification(id: string): Promise<EventNotification> {
    const notification = await this.findNotificationById(id);
    notification.retryCount += 1;
    notification.sentAt = new Date();
    notification.sendSuccess = true;
    notification.failureReason = null;
    return this.notificationRepo.save(notification);
  }
}
