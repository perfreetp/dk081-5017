import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Device } from './device.entity';
import { Person } from './person.entity';
import { Area } from './area.entity';

@Entity('person_stay_records')
@Index(['personId', 'areaId', 'startTime'])
export class PersonStayRecord extends BaseEntity {
  @Column({ name: 'person_id' })
  personId: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'area_id' })
  areaId: string;

  @Column({ name: 'hospital_id' })
  hospitalId: string;

  @Column({ name: 'building_id' })
  buildingId: string;

  @Column({ name: 'floor_id' })
  floorId: string;

  @Column({ type: 'datetime', name: 'start_time' })
  startTime: Date;

  @Column({ type: 'datetime', nullable: true, name: 'end_time' })
  endTime: Date;

  @Column({ type: 'int', default: 0, name: 'duration_seconds' })
  durationSeconds: number;

  @Column({ type: 'simple-json', nullable: true, name: 'snapshots' })
  snapshots: string[];

  @Column({ default: false, name: 'is_processed' })
  isProcessed: boolean;

  @Column({ default: false, name: 'is_merged' })
  isMerged: boolean;

  @Column({ name: 'merged_into_event_id', nullable: true })
  mergedIntoEventId: string;

  @ManyToOne(() => Device, device => device.stayRecords)
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @ManyToOne(() => Person, person => person.stayRecords)
  @JoinColumn({ name: 'person_id' })
  person: Person;

  @ManyToOne(() => Area)
  @JoinColumn({ name: 'area_id' })
  area: Area;
}
