import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PersonStayRecord } from './person-stay-record.entity';
import { SecurityEvent } from './security-event.entity';

@Entity('persons')
export class Person extends BaseEntity {
  @Column({ length: 50, unique: true, nullable: true, name: 'person_id' })
  personId: string;

  @Column({ length: 100, nullable: true, name: 'face_id' })
  faceId: string;

  @Column({ length: 50, nullable: true, name: 'id_card_no' })
  idCardNo: string;

  @Column({ length: 50, nullable: true, name: 'employee_no' })
  employeeNo: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'int', nullable: true })
  age: number;

  @Column({ length: 10, nullable: true })
  gender: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'visitor',
    name: 'person_type',
  })
  personType: string;

  @Column({ length: 20, nullable: true, name: 'phone' })
  phone: string;

  @Column({ length: 200, nullable: true, name: 'avatar_url' })
  avatarUrl: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ type: 'simple-json', nullable: true, name: 'extra_info' })
  extraInfo: Record<string, any>;

  @OneToMany(() => PersonStayRecord, record => record.person)
  stayRecords: PersonStayRecord[];

  @OneToMany(() => SecurityEvent, event => event.person)
  events: SecurityEvent[];
}
