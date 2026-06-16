import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { StrictModeType } from '../../common/enums';

@Entity('strict_mode_configs')
export class StrictModeConfig extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'mode_type',
  })
  modeType: StrictModeType;

  @Column({ name: 'hospital_id', nullable: true, comment: '院区ID，为空表示集团级' })
  hospitalId: string;

  @Column({ type: 'simple-json', name: 'scope_hospital_ids', comment: '适用院区ID列表，空表示全部' })
  scopeHospitalIds: string[];

  @Column({ type: 'datetime', name: 'start_time' })
  startTime: Date;

  @Column({ type: 'datetime', name: 'end_time' })
  endTime: Date;

  @Column({ type: 'int', name: 'sensitivity_multiplier', default: 50, comment: '灵敏度调整百分比，如50表示规则阈值降低50%' })
  sensitivityMultiplier: number;

  @Column({ type: 'simple-json', nullable: true, name: 'rule_overrides', comment: '特定规则覆盖' })
  ruleOverrides: Array<{
    ruleId: string;
    maxStaySeconds: number;
    eventLevel: string;
  }>;

  @Column({ type: 'simple-json', name: 'forced_notification_targets', comment: '强制追加的通知目标' })
  forcedNotificationTargets: string[];

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'text', nullable: true, name: 'created_reason' })
  createdReason: string;
}
