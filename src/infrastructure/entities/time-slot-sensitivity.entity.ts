import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { StayRule } from './stay-rule.entity';
import { SensitivityLevel, EventLevel } from '../../common/enums';

@Entity('time_slot_sensitivities')
export class TimeSlotSensitivity extends BaseEntity {
  @Column({ name: 'rule_id' })
  ruleId: string;

  @Column({ length: 20, name: 'start_time', comment: '开始时间 HH:mm' })
  startTime: string;

  @Column({ length: 20, name: 'end_time', comment: '结束时间 HH:mm' })
  endTime: string;

  @Column({ type: 'simple-array', name: 'weekdays', comment: '适用星期几，0-6 表示周日到周六' })
  weekdays: number[];

  @Column({
    type: 'varchar',
    length: 20,
    name: 'sensitivity_level',
  })
  sensitivityLevel: SensitivityLevel;

  @Column({ type: 'int', nullable: true, name: 'override_max_stay_seconds', comment: '覆盖的最大停留时间（秒）' })
  overrideMaxStaySeconds: number;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'override_event_level',
  })
  overrideEventLevel: EventLevel;

  @Column({ default: true })
  enabled: boolean;

  @ManyToOne(() => StayRule, rule => rule.timeSlotSensitivities)
  @JoinColumn({ name: 'rule_id' })
  rule: StayRule;
}
