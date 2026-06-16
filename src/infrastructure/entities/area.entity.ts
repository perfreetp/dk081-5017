import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Floor } from './floor.entity';
import { Device } from './device.entity';
import { SceneType } from '../../common/enums';
import { StayRule } from './stay-rule.entity';

@Entity('areas')
export class Area extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  code: string;

  @Column({ name: 'floor_id' })
  floorId: string;

  @Column({ name: 'hospital_id' })
  hospitalId: string;

  @Column({ name: 'building_id' })
  buildingId: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'scene_type',
  })
  sceneType: SceneType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'area_size' })
  areaSize: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @ManyToOne(() => Floor, floor => floor.areas)
  @JoinColumn({ name: 'floor_id' })
  floor: Floor;

  @OneToMany(() => Device, device => device.area)
  devices: Device[];

  @OneToMany(() => StayRule, rule => rule.area)
  stayRules: StayRule[];
}
