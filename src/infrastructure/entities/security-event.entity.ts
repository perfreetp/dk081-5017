import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Person } from './person.entity';
import { EventFlowTrail } from './event-flow-trail.entity';
import { EventNotification } from './event-notification.entity';
import { EventLevel, EventStatus, FalseAlarmCategory } from '../../common/enums';

@Entity('security_events')
@Index(['hospitalId', 'status', 'createdAt'])
@Index(['personId', 'status'])
export class SecurityEvent extends BaseEntity {
  @Column({ length: 50, unique: true, name: 'event_no' })
  eventNo: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'hospital_id' })
  hospitalId: string;

  @Column({ name: 'building_id' })
  buildingId: string;

  @Column({ name: 'floor_id' })
  floorId: string;

  @Column({ name: 'initial_area_id' })
  initialAreaId: string;

  @Column({ type: 'simple-json', name: 'involved_area_ids', comment: '涉及的所有区域ID列表' })
  involvedAreaIds: string[];

  @Column({ type: 'simple-json', name: 'involved_device_ids', comment: '涉及的所有设备ID列表' })
  involvedDeviceIds: string[];

  @Column({ name: 'person_id', nullable: true })
  personId: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'event_level',
  })
  eventLevel: EventLevel;

  @Column({
    type: 'varchar',
    length: 30,
    default: EventStatus.PENDING,
  })
  status: EventStatus;

  @Column({ type: 'datetime', name: 'first_detected_at' })
  firstDetectedAt: Date;

  @Column({ type: 'datetime', name: 'last_detected_at' })
  lastDetectedAt: Date;

  @Column({ type: 'int', name: 'total_duration_seconds', comment: '总停留时长（秒）' })
  totalDurationSeconds: number;

  @Column({ type: 'int', default: 0, name: 'area_change_count', comment: '跨区域次数' })
  areaChangeCount: number;

  @Column({ type: 'simple-json', nullable: true, name: 'snapshots' })
  snapshots: string[];

  @Column({ type: 'simple-json', nullable: true, name: 'stay_timeline', comment: '停留时间线记录' })
  stayTimeline: Array<{
    recordId?: string;
    areaId: string;
    deviceId: string;
    startTime: Date;
    endTime: Date;
    durationSeconds: number;
  }>;

  @Column({ name: 'matched_rule_id', nullable: true })
  matchedRuleId: string;

  @Column({ length: 100, nullable: true, name: 'matched_rule_name' })
  matchedRuleName: string;

  @Column({ default: false, name: 'is_key_focus', comment: '是否为重点关注事件' })
  isKeyFocus: boolean;

  @Column({ type: 'text', nullable: true, name: 'key_focus_reason', comment: '升级为重点关注的原因' })
  keyFocusReason: string;

  @Column({ type: 'datetime', nullable: true, name: 'escalated_at' })
  escalatedAt: Date;

  @Column({ length: 50, nullable: true, name: 'escalated_by' })
  escalatedBy: string;

  @Column({ type: 'text', nullable: true, name: 'disposition_remark', comment: '处置备注' })
  dispositionRemark: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'false_alarm_category',
  })
  falseAlarmCategory: FalseAlarmCategory;

  @Column({ type: 'text', nullable: true, name: 'false_alarm_remark', comment: '误报说明' })
  falseAlarmRemark: string;

  @Column({ type: 'datetime', nullable: true, name: 'dispatched_at' })
  dispatchedAt: string;

  @Column({ type: 'datetime', nullable: true, name: 'processing_started_at' })
  processingStartedAt: Date;

  @Column({ type: 'datetime', nullable: true, name: 'resolved_at' })
  resolvedAt: Date;

  @Column({ type: 'datetime', nullable: true, name: 'closed_at' })
  closedAt: Date;

  @Column({ length: 50, nullable: true, name: 'assigned_to', comment: '当前处置人' })
  assignedTo: string;

  @Column({ length: 100, nullable: true, name: 'assigned_to_name', comment: '当前处置人名称' })
  assignedToName: string;

  @Column({ length: 50, nullable: true, name: 'resolved_by' })
  resolvedBy: string;

  @Column({ type: 'int', default: 0, name: 'handling_duration_seconds', comment: '处置耗时（秒）' })
  handlingDurationSeconds: number;

  @Column({ default: false, name: 'strict_mode_triggered', comment: '是否在严控模式下触发' })
  strictModeTriggered: boolean;

  @Column({ type: 'simple-json', nullable: true, name: 'extra_data' })
  extraData: Record<string, any>;

  @ManyToOne(() => Person, person => person.events, { nullable: true })
  @JoinColumn({ name: 'person_id' })
  person: Person;

  @OneToMany(() => EventFlowTrail, trail => trail.event)
  flowTrails: EventFlowTrail[];

  @OneToMany(() => EventNotification, notification => notification.event)
  notifications: EventNotification[];
}
