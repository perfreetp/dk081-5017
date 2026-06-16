import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Building } from './building.entity';

@Entity('hospitals')
export class Hospital extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ length: 200, nullable: true })
  address: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 50, nullable: true, name: 'admin_name' })
  adminName: string;

  @Column({ length: 20, nullable: true, name: 'admin_phone' })
  adminPhone: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'simple-json', nullable: true, name: 'strict_mode_config' })
  strictModeConfig: {
    enabled: boolean;
    mode: string;
    startTime: Date;
    endTime: Date;
    reason: string;
  };

  @OneToMany(() => Building, building => building.hospital)
  buildings: Building[];
}
