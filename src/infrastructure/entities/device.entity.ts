import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Area } from './area.entity';
import { DeviceType, DeviceStatus } from '../../common/enums';
import { PersonStayRecord } from './person-stay-record.entity';

@Entity('devices')
export class Device extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'device_type',
  })
  deviceType: DeviceType;

  @Column({ name: 'area_id' })
  areaId: string;

  @Column({ name: 'hospital_id' })
  hospitalId: string;

  @Column({ name: 'building_id' })
  buildingId: string;

  @Column({ name: 'floor_id' })
  floorId: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: DeviceStatus.ONLINE,
  })
  status: DeviceStatus;

  @Column({ length: 200, nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ length: 100, nullable: true, name: 'manufacturer' })
  manufacturer: string;

  @Column({ length: 100, nullable: true, name: 'model' })
  model: string;

  @Column({ type: 'simple-json', nullable: true, name: 'extra_config' })
  extraConfig: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @ManyToOne(() => Area, area => area.devices)
  @JoinColumn({ name: 'area_id' })
  area: Area;

  @OneToMany(() => PersonStayRecord, record => record.device)
  stayRecords: PersonStayRecord[];
}
