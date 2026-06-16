import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('audit_logs')
@Index(['hospitalId', 'actionType', 'createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ name: 'hospital_id', nullable: true })
  hospitalId: string;

  @Column({ name: 'event_id', nullable: true })
  eventId: string;

  @Column({ length: 50, name: 'user_id', nullable: true })
  userId: string;

  @Column({ length: 100, name: 'user_name', nullable: true })
  userName: string;

  @Column({ length: 50, name: 'user_role', nullable: true })
  userRole: string;

  @Column({ length: 100, name: 'action_type' })
  actionType: string;

  @Column({ length: 200, nullable: true, name: 'action_target' })
  actionTarget: string;

  @Column({ type: 'text', name: 'action_detail', nullable: true })
  actionDetail: string;

  @Column({ type: 'simple-json', nullable: true, name: 'old_value' })
  oldValue: any;

  @Column({ type: 'simple-json', nullable: true, name: 'new_value' })
  newValue: any;

  @Column({ length: 50, nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ length: 200, nullable: true, name: 'user_agent' })
  userAgent: string;
}
