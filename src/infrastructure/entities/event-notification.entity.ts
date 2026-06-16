import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SecurityEvent } from './security-event.entity';
import { NotificationTarget, NotificationChannel } from '../../common/enums';

@Entity('event_notifications')
export class EventNotification extends BaseEntity {
  @Column({ name: 'event_id' })
  eventId: string;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'target_type',
  })
  targetType: NotificationTarget;

  @Column({ length: 100, nullable: true, name: 'target_name', comment: '接收方名称，如监控室A、巡逻组1' })
  targetName: string;

  @Column({ length: 50, nullable: true, name: 'target_user_id' })
  targetUserId: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'channel',
  })
  channel: NotificationChannel;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-json', nullable: true, name: 'extra_payload' })
  extraPayload: Record<string, any>;

  @Column({ type: 'datetime', nullable: true, name: 'sent_at' })
  sentAt: Date;

  @Column({ type: 'datetime', nullable: true, name: 'read_at' })
  readAt: Date;

  @Column({ default: false, name: 'is_read' })
  isRead: boolean;

  @Column({ type: 'int', default: 0, name: 'retry_count', comment: '重试次数' })
  retryCount: number;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason: string;

  @Column({ default: false, name: 'send_success' })
  sendSuccess: boolean;

  @ManyToOne(() => SecurityEvent, event => event.notifications)
  @JoinColumn({ name: 'event_id' })
  event: SecurityEvent;
}
