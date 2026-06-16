import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Hospital } from './hospital.entity';
import { Floor } from './floor.entity';

@Entity('buildings')
export class Building extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  code: string;

  @Column({ name: 'hospital_id' })
  hospitalId: string;

  @Column({ type: 'int', nullable: true, name: 'floor_count' })
  floorCount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @ManyToOne(() => Hospital, hospital => hospital.buildings)
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @OneToMany(() => Floor, floor => floor.building)
  floors: Floor[];
}
