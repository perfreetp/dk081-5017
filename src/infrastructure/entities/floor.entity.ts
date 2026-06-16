import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Building } from './building.entity';
import { Area } from './area.entity';

@Entity('floors')
export class Floor extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  code: string;

  @Column({ name: 'building_id' })
  buildingId: string;

  @Column({ type: 'int', name: 'floor_number' })
  floorNumber: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @ManyToOne(() => Building, building => building.floors)
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @OneToMany(() => Area, area => area.floor)
  areas: Area[];
}
