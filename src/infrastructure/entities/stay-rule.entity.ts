import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Area } from './area.entity';
import { SceneType, EventLevel, SensitivityLevel } from '../../common/enums';
import { TimeSlotSensitivity } from './time-slot-sensitivity.entity';

@Entity('stay_rules')
export class StayRule extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 200, nullable: true })
  description: string;

  @Column({ name: 'area_id', nullable: true })
  areaId: string;

  @Column({ name: 'hospital_id', nullable: true })
  hospitalId: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'scene_type',
    nullable: true,
  })
  sceneType: SceneType;

  @Column({
    type: 'varchar',
    length: 20,
    default: EventLevel.MEDIUM,
    name: 'event_level',
  })
  eventLevel: EventLevel;

  @Column({ type: 'int', name: 'max_stay_seconds', comment: '最大停留时间（秒），超过则触发告警' })
  maxStaySeconds: number;

  @Column({ type: 'int', default: 0, name: 'warning_stay_seconds', comment: '预警停留时间（秒），开始关注' })
  warningStaySeconds: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: SensitivityLevel.MEDIUM,
    name: 'default_sensitivity',
  })
  defaultSensitivity: SensitivityLevel;

  @Column({ type: 'simple-json', name: 'notification_targets', comment: '通知目标列表' })
  notificationTargets: string[];

  @Column({ type: 'boolean', default: true, name: 'merge_same_person', comment: '是否合并同一人员多点位停留' })
  mergeSamePerson: boolean;

  @Column({ type: 'int', default: 300, name: 'merge_time_window_seconds', comment: '同一人员合并时间窗口（秒）' })
  mergeTimeWindowSeconds: number;

  @Column({ type: 'boolean', default: true, name: 'apply_to_strict_mode', comment: '是否在严控模式下启用' })
  applyToStrictMode: boolean;

  @Column({ type: 'simple-json', nullable: true, name: 'strict_mode_override', comment: '严控模式下的规则覆盖配置' })
  strictModeOverride: {
    maxStaySeconds: number;
    eventLevel: EventLevel;
    sensitivity: SensitivityLevel;
  };

  @Column({ type: 'int', default: 0, name: 'priority', comment: '规则优先级，数字越大优先级越高' })
  priority: number;

  @Column({ default: true })
  enabled: boolean;

  @ManyToOne(() => Area, area => area.stayRules, { nullable: true })
  @JoinColumn({ name: 'area_id' })
  area: Area;

  @OneToMany(() => TimeSlotSensitivity, slot => slot.rule, { cascade: true })
  timeSlotSensitivities: TimeSlotSensitivity[];
}
