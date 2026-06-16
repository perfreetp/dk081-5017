import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device, Person, PersonStayRecord, Area } from '../../../infrastructure/entities';
import {
  CreateDeviceDto,
  UpdateDeviceDto,
  QueryDeviceDto,
  CreatePersonDto,
  CreateStayRecordDto,
} from '../dto/device.dto';
import { PaginationDto, PaginatedResultDto } from '../../../common/dto/common.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeviceStatus } from '../../../common/enums';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Person) private readonly personRepo: Repository<Person>,
    @InjectRepository(PersonStayRecord) private readonly stayRecordRepo: Repository<PersonStayRecord>,
    @InjectRepository(Area) private readonly areaRepo: Repository<Area>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createDevice(dto: CreateDeviceDto, operator: any): Promise<Device> {
    const area = await this.areaRepo.findOneBy({ id: dto.areaId, isDeleted: false }) as Area;
    if (!area) throw new NotFoundException(`区域不存在: ${dto.areaId}`);

    const device = this.deviceRepo.create({
      ...dto,
      hospitalId: area.hospitalId,
      buildingId: area.buildingId,
      floorId: area.floorId,
      status: DeviceStatus.ONLINE,
      createdBy: operator.userId,
      updatedBy: operator.userId,
    });
    const saved = await this.deviceRepo.save(device);
    this.emitAudit('device.create', operator, saved.id, saved);
    return saved;
  }

  async updateDevice(id: string, dto: UpdateDeviceDto, operator: any): Promise<Device> {
    const device = await this.findDeviceById(id);
    const updateData: any = { ...dto, updatedBy: operator.userId };

    if (dto.areaId && dto.areaId !== device.areaId) {
      const area = await this.areaRepo.findOneBy({ id: dto.areaId, isDeleted: false }) as Area;
      if (!area) throw new NotFoundException(`区域不存在: ${dto.areaId}`);
      updateData.hospitalId = area.hospitalId;
      updateData.buildingId = area.buildingId;
      updateData.floorId = area.floorId;
    }

    const merged = this.deviceRepo.merge(device, updateData);
    const saved = await this.deviceRepo.save(merged);
    this.emitAudit('device.update', operator, saved.id, dto);
    return saved;
  }

  async findDeviceById(id: string): Promise<Device> {
    const device = await this.deviceRepo.findOne({ where: { id, isDeleted: false }, relations: ['area'] }) as Device;
    if (!device) throw new NotFoundException(`设备不存在: ${id}`);
    return device;
  }

  async queryDevices(query: QueryDeviceDto, pagination: PaginationDto): Promise<PaginatedResultDto<Device>> {
    const qb = this.deviceRepo.createQueryBuilder('d').where('d.isDeleted = :isDeleted', { isDeleted: false });

    if (query.hospitalId) qb.andWhere('d.hospitalId = :hospitalId', { hospitalId: query.hospitalId });
    if (query.buildingId) qb.andWhere('d.buildingId = :buildingId', { buildingId: query.buildingId });
    if (query.floorId) qb.andWhere('d.floorId = :floorId', { floorId: query.floorId });
    if (query.areaId) qb.andWhere('d.areaId = :areaId', { areaId: query.areaId });
    if (query.deviceType) qb.andWhere('d.deviceType = :deviceType', { deviceType: query.deviceType });
    if (query.status) qb.andWhere('d.status = :status', { status: query.status });
    if (query.keyword) qb.andWhere('(d.name LIKE :keyword OR d.code LIKE :keyword OR d.ipAddress LIKE :keyword)', { keyword: `%${query.keyword}%` });

    qb.orderBy('d.createdAt', 'DESC')
      .leftJoinAndSelect('d.area', 'area')
      .skip((pagination.page - 1) * pagination.pageSize)
      .take(pagination.pageSize);

    const [list, total] = await qb.getManyAndCount();
    return PaginatedResultDto.create(list, total, pagination.page, pagination.pageSize);
  }

  async getDeviceStats(hospitalId?: string): Promise<any> {
    const qb = this.deviceRepo.createQueryBuilder('d').where('d.isDeleted = :isDeleted', { isDeleted: false });
    if (hospitalId) qb.andWhere('d.hospitalId = :hospitalId', { hospitalId });

    const total = await qb.getCount();
    const online = await this.deviceRepo.count({ where: { status: DeviceStatus.ONLINE, isDeleted: false, ...(hospitalId && { hospitalId }) } });
    const offline = await this.deviceRepo.count({ where: { status: DeviceStatus.OFFLINE, isDeleted: false, ...(hospitalId && { hospitalId }) } });
    const fault = await this.deviceRepo.count({ where: { status: DeviceStatus.FAULT, isDeleted: false, ...(hospitalId && { hospitalId }) } });

    return { total, online, offline, fault };
  }

  async createOrUpdatePerson(dto: CreatePersonDto): Promise<Person> {
    let person: Person | null = null;

    if (dto.personId) {
      person = await this.personRepo.findOneBy({ personId: dto.personId, isDeleted: false }) as Person;
    }
    if (!person && dto.faceId) {
      person = await this.personRepo.findOneBy({ faceId: dto.faceId, isDeleted: false }) as Person;
    }
    if (!person && dto.idCardNo) {
      person = await this.personRepo.findOneBy({ idCardNo: dto.idCardNo, isDeleted: false }) as Person;
    }

    if (person) {
      const merged = this.personRepo.merge(person, dto);
      return this.personRepo.save(merged);
    }

    person = this.personRepo.create(dto);
    return this.personRepo.save(person);
  }

  async findPersonById(id: string): Promise<Person> {
    const person = await this.personRepo.findOneBy({ id, isDeleted: false }) as Person;
    if (!person) throw new NotFoundException(`人员不存在: ${id}`);
    return person;
  }

  async reportStayRecord(dto: CreateStayRecordDto): Promise<PersonStayRecord> {
    const device = await this.findDeviceById(dto.deviceId);
    const person = await this.findPersonById(dto.personId);

    const record = this.stayRecordRepo.create({
      ...dto,
      hospitalId: device.hospitalId,
      buildingId: device.buildingId,
      floorId: device.floorId,
      areaId: device.areaId,
    });
    const saved = await this.stayRecordRepo.save(record);

    this.eventEmitter.emit('stay.record.created', {
      recordId: saved.id,
      personId: person.id,
      areaId: device.areaId,
      hospitalId: device.hospitalId,
      startTime: saved.startTime,
      durationSeconds: saved.durationSeconds,
    });

    return saved;
  }

  async updateStayRecordEndTime(recordId: string, endTime: Date, durationSeconds: number): Promise<PersonStayRecord> {
    const record = await this.stayRecordRepo.findOneBy({ id: recordId }) as PersonStayRecord;
    if (!record) throw new NotFoundException(`停留记录不存在: ${recordId}`);

    record.endTime = endTime;
    record.durationSeconds = durationSeconds;
    const saved = await this.stayRecordRepo.save(record);

    this.eventEmitter.emit('stay.record.completed', {
      recordId: saved.id,
      personId: saved.personId,
      areaId: saved.areaId,
      hospitalId: saved.hospitalId,
      durationSeconds: saved.durationSeconds,
    });

    return saved;
  }

  async findUnprocessedStayRecords(hospitalId?: string): Promise<PersonStayRecord[]> {
    const where: any = { isProcessed: false };
    if (hospitalId) where.hospitalId = hospitalId;
    return this.stayRecordRepo.find({ where, order: { startTime: 'ASC' } });
  }

  async markStayRecordsProcessed(ids: string[]): Promise<void> {
    await this.stayRecordRepo.update(ids, { isProcessed: true });
  }

  private emitAudit(action: string, operator: any, targetId: string, data: any) {
    this.eventEmitter.emit('audit.log', {
      actionType: action,
      actionTarget: targetId,
      actionDetail: JSON.stringify(data),
      userId: operator.userId,
      userName: operator.userName,
      userRole: operator.userRole,
    });
  }
}
