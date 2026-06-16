import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SecurityEvent } from './security-event.entity';
import { EventStatus } from '../../common/enums';

@Entity('event_flow_trails')
export class EventFlowTrail extends BaseEntity {
  @Column({ name: 'event_id' })
  eventId: string;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'from_status',
    nullable: true,
  })
  fromStatus: EventStatus;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'to_status',
  })
  toStatus: EventStatus;

  @Column({ type: 'text', name: 'action_type', comment: '操作类型：创建、派单、升级、处置、关闭、误报等' })
  actionType: string;

  @Column({ type: 'text', nullable: true, comment: '操作说明' })
  remark: string;

  @Column({ length: 50, nullable: true, name: 'operator_id' })
  operatorId: string;

  @Column({ length: 100, nullable: true, name: 'operator_name' })
  operatorName: string;

  @Column({ length: 50, nullable: true, name: 'operator_role' })
  operatorRole: string;

  @Column({ length: 50, nullable: true, name: 'assigned_to', comment: '流转目标人' })
  assignedTo: string;

  @Column({ length: 100, nullable: true, name: 'assigned_to_name' })
  assignedToName: string;

  @ManyToOne(() => SecurityEvent, event => event.flowTrails)
  @JoinColumn({ name: 'event_id' })
  event: SecurityEvent;
}
