import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { FalseAlarmCategory } from '../../common/enums';

@Entity('false_alarm_statistics')
@Index(['hospitalId', 'category', 'statDate'])
export class FalseAlarmStatistic extends BaseEntity {
  @Column({ name: 'hospital_id' })
  hospitalId: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  category: FalseAlarmCategory;

  @Column({ type: 'date', name: 'stat_date' })
  statDate: string;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ type: 'text', nullable: true, name: 'category_remarks', comment: '该类别误报汇总分析' })
  categoryRemarks: string;
}
