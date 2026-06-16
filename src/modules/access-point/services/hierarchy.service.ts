import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital, Building, Floor, Area } from '../../../infrastructure/entities';
import {
  CreateHospitalDto,
  UpdateHospitalDto,
  CreateBuildingDto,
  UpdateBuildingDto,
  CreateFloorDto,
  UpdateFloorDto,
  CreateAreaDto,
  UpdateAreaDto,
  QueryAreaDto,
} from '../dto/hierarchy.dto';
import { PaginationDto, PaginatedResultDto } from '../../../common/dto/common.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class HierarchyService {
  constructor(
    @InjectRepository(Hospital) private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(Building) private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Floor) private readonly floorRepo: Repository<Floor>,
    @InjectRepository(Area) private readonly areaRepo: Repository<Area>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createHospital(dto: CreateHospitalDto, operator: any): Promise<Hospital> {
    const hospital = this.hospitalRepo.create({
      ...dto,
      createdBy: operator.userId,
      updatedBy: operator.userId,
    });
    const saved = await this.hospitalRepo.save(hospital);
    this.emitAudit('hospital.create', operator, saved.id, saved);
    return saved;
  }

  async updateHospital(id: string, dto: UpdateHospitalDto, operator: any): Promise<Hospital> {
    const hospital = await this.findHospitalById(id);
    const merged = this.hospitalRepo.merge(hospital, { ...dto, updatedBy: operator.userId });
    const saved = await this.hospitalRepo.save(merged);
    this.emitAudit('hospital.update', operator, saved.id, dto);
    return saved;
  }

  async findHospitalById(id: string): Promise<Hospital> {
    const hospital = await this.hospitalRepo.findOneBy({ id, isDeleted: false }) as Hospital;
    if (!hospital) throw new NotFoundException(`院区不存在: ${id}`);
    return hospital;
  }

  async findAllHospitals(): Promise<Hospital[]> {
    return this.hospitalRepo.find({ where: { isDeleted: false }, order: { createdAt: 'DESC' } });
  }

  async createBuilding(dto: CreateBuildingDto, operator: any): Promise<Building> {
    await this.findHospitalById(dto.hospitalId);
    const building = this.buildingRepo.create({
      ...dto,
      createdBy: operator.userId,
      updatedBy: operator.userId,
    });
    const saved = await this.buildingRepo.save(building);
    this.emitAudit('building.create', operator, saved.id, saved);
    return saved;
  }

  async updateBuilding(id: string, dto: UpdateBuildingDto, operator: any): Promise<Building> {
    const building = await this.findBuildingById(id);
    const merged = this.buildingRepo.merge(building, { ...dto, updatedBy: operator.userId });
    const saved = await this.buildingRepo.save(merged);
    this.emitAudit('building.update', operator, saved.id, dto);
    return saved;
  }

  async findBuildingById(id: string): Promise<Building> {
    const building = await this.buildingRepo.findOneBy({ id, isDeleted: false }) as Building;
    if (!building) throw new NotFoundException(`楼栋不存在: ${id}`);
    return building;
  }

  async findBuildingsByHospital(hospitalId: string): Promise<Building[]> {
    return this.buildingRepo.find({ where: { hospitalId, isDeleted: false }, order: { code: 'ASC' } });
  }

  async createFloor(dto: CreateFloorDto, operator: any): Promise<Floor> {
    const building = await this.findBuildingById(dto.buildingId);
    const floor = this.floorRepo.create({
      ...dto,
      hospitalId: building.hospitalId,
      buildingId: building.id,
      createdBy: operator.userId,
      updatedBy: operator.userId,
    } as any);
    const saved = (await this.floorRepo.save(floor)) as unknown as Floor;
    this.emitAudit('floor.create', operator, saved.id, saved);
    return saved;
  }

  async updateFloor(id: string, dto: UpdateFloorDto, operator: any): Promise<Floor> {
    const floor = await this.findFloorById(id);
    const merged = this.floorRepo.merge(floor, { ...dto, updatedBy: operator.userId });
    const saved = await this.floorRepo.save(merged);
    this.emitAudit('floor.update', operator, saved.id, dto);
    return saved;
  }

  async findFloorById(id: string): Promise<Floor> {
    const floor = await this.floorRepo.findOneBy({ id, isDeleted: false }) as Floor;
    if (!floor) throw new NotFoundException(`楼层不存在: ${id}`);
    return floor;
  }

  async findFloorsByBuilding(buildingId: string): Promise<Floor[]> {
    return this.floorRepo.find({ where: { buildingId, isDeleted: false }, order: { floorNumber: 'ASC' } });
  }

  async createArea(dto: CreateAreaDto, operator: any): Promise<Area> {
    const floor = await this.findFloorById(dto.floorId);
    const building = await this.findBuildingById(floor.buildingId);
    const area = this.areaRepo.create({
      ...dto,
      hospitalId: building.hospitalId,
      buildingId: building.id,
      floorId: floor.id,
      createdBy: operator.userId,
      updatedBy: operator.userId,
    } as any);
    const saved = (await this.areaRepo.save(area)) as unknown as Area;
    this.emitAudit('area.create', operator, saved.id, saved);
    return saved;
  }

  async updateArea(id: string, dto: UpdateAreaDto, operator: any): Promise<Area> {
    const area = await this.findAreaById(id);
    const merged = this.areaRepo.merge(area, { ...dto, updatedBy: operator.userId } as any);
    const saved = (await this.areaRepo.save(merged)) as Area;
    this.emitAudit('area.update', operator, saved.id, dto);
    return saved;
  }

  async findAreaById(id: string): Promise<Area> {
    const area = await this.areaRepo.findOneBy({ id, isDeleted: false }) as Area;
    if (!area) throw new NotFoundException(`区域不存在: ${id}`);
    return area;
  }

  async queryAreas(query: QueryAreaDto, pagination: PaginationDto): Promise<PaginatedResultDto<Area>> {
    const qb = this.areaRepo.createQueryBuilder('a').where('a.isDeleted = :isDeleted', { isDeleted: false });

    if (query.hospitalId) qb.andWhere('a.hospitalId = :hospitalId', { hospitalId: query.hospitalId });
    if (query.buildingId) qb.andWhere('a.buildingId = :buildingId', { buildingId: query.buildingId });
    if (query.floorId) qb.andWhere('a.floorId = :floorId', { floorId: query.floorId });
    if (query.sceneType) qb.andWhere('a.sceneType = :sceneType', { sceneType: query.sceneType });
    if (query.keyword) qb.andWhere('(a.name LIKE :keyword OR a.code LIKE :keyword)', { keyword: `%${query.keyword}%` });

    qb.orderBy('a.createdAt', 'DESC')
      .skip((pagination.page - 1) * pagination.pageSize)
      .take(pagination.pageSize);

    const [list, total] = await qb.getManyAndCount();
    return PaginatedResultDto.create(list, total, pagination.page, pagination.pageSize);
  }

  async findAreasByFloor(floorId: string): Promise<Area[]> {
    return this.areaRepo.find({ where: { floorId, isDeleted: false }, order: { code: 'ASC' } });
  }

  async getFullHierarchy(): Promise<any[]> {
    const hospitals = await this.hospitalRepo.find({
      where: { isDeleted: false },
      relations: ['buildings', 'buildings.floors', 'buildings.floors.areas'],
      order: { code: 'ASC' },
    });
    return hospitals;
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
