import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrictModeConfig, Hospital } from '../../../infrastructure/entities';
import { CreateStrictModeDto, UpdateStrictModeDto } from '../dto/audit.dto';
import { PaginationDto, PaginatedResultDto } from '../../../common/dto/common.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StrictModeType } from '../../../common/enums';

@Injectable()
export class StrictModeService {
  private readonly logger = new Logger(StrictModeService.name);

  constructor(
    @InjectRepository(StrictModeConfig) private readonly strictModeRepo: Repository<StrictModeConfig>,
    @InjectRepository(Hospital) private readonly hospitalRepo: Repository<Hospital>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createConfig(dto: CreateStrictModeDto, operator: any): Promise<StrictModeConfig> {
    const config = this.strictModeRepo.create({
      ...dto,
      forcedNotificationTargets: dto.forcedNotificationTargets || [],
      scopeHospitalIds: dto.scopeHospitalIds || [],
      sensitivityMultiplier: dto.sensitivityMultiplier || 50,
      createdBy: operator.userId,
      updatedBy: operator.userId,
    });
    const saved = await this.strictModeRepo.save(config);

    this.logger.log(`创建严控模式: ${saved.name}, ID=${saved.id}`);
    this.eventEmitter.emit('audit.log', {
      actionType: 'strict_mode.create',
      actionTarget: saved.id,
      actionDetail: JSON.stringify(saved),
      userId: operator.userId,
      userName: operator.userName,
      userRole: operator.userRole,
    });

    await this.applyToHospitals(saved);
    return saved;
  }

  async updateConfig(id: string, dto: UpdateStrictModeDto, operator: any): Promise<StrictModeConfig> {
    const config = await this.findConfigById(id);
    const merged = this.strictModeRepo.merge(config, { ...dto, updatedBy: operator.userId });
    const saved = await this.strictModeRepo.save(merged);

    this.eventEmitter.emit('audit.log', {
      actionType: 'strict_mode.update',
      actionTarget: saved.id,
      actionDetail: JSON.stringify(dto),
      userId: operator.userId,
      userName: operator.userName,
      userRole: operator.userRole,
    });

    return saved;
  }

  async findConfigById(id: string): Promise<StrictModeConfig> {
    const config = await this.strictModeRepo.findOneBy({ id, isDeleted: false }) as StrictModeConfig;
    if (!config) throw new NotFoundException(`严控模式配置不存在: ${id}`);
    return config;
  }

  async queryConfigs(
    hospitalId?: string,
    pagination?: PaginationDto,
  ): Promise<PaginatedResultDto<StrictModeConfig>> {
    const qb = this.strictModeRepo.createQueryBuilder('s').where('s.isDeleted = :isDeleted', { isDeleted: false });

    if (hospitalId) {
      qb.andWhere('(s.hospitalId IS NULL OR s.hospitalId = :hospitalId)', { hospitalId });
    }

    qb.orderBy('s.createdAt', 'DESC');

    if (pagination) {
      qb.skip((pagination.page - 1) * pagination.pageSize).take(pagination.pageSize);
    }

    const [list, total] = await qb.getManyAndCount();
    return PaginatedResultDto.create(list, total, pagination?.page || 1, pagination?.pageSize || 20);
  }

  async getActiveConfigs(hospitalId?: string): Promise<StrictModeConfig[]> {
    const now = new Date();
    const qb = this.strictModeRepo
      .createQueryBuilder('s')
      .where('s.isDeleted = 0 AND s.enabled = 1 AND s.startTime <= :now AND s.endTime >= :now', { now });

    if (hospitalId) {
      qb.andWhere('(s.hospitalId IS NULL OR s.hospitalId = :hospitalId)', { hospitalId });
    }

    const configs = await qb.getMany();

    if (hospitalId) {
      return configs.filter(
        c => c.scopeHospitalIds.length === 0 || c.scopeHospitalIds.includes(hospitalId),
      );
    }

    return configs;
  }

  async checkHospitalStrictMode(hospitalId: string): Promise<{ active: boolean; configs: StrictModeConfig[] }> {
    const activeConfigs = await this.getActiveConfigs(hospitalId);
    return {
      active: activeConfigs.length > 0,
      configs: activeConfigs,
    };
  }

  private async applyToHospitals(config: StrictModeConfig): Promise<void> {
    if (!config.enabled) return;

    let hospitals: Hospital[];
    if (config.hospitalId) {
      hospitals = [await this.hospitalRepo.findOneBy({ id: config.hospitalId, isDeleted: false }) as Hospital].filter(Boolean);
    } else if (config.scopeHospitalIds && config.scopeHospitalIds.length > 0) {
      hospitals = await this.hospitalRepo.findByIds(config.scopeHospitalIds);
    } else {
      hospitals = await this.hospitalRepo.find({ where: { isDeleted: false } });
    }

    for (const hospital of hospitals) {
      hospital.strictModeConfig = {
        enabled: true,
        mode: config.modeType,
        startTime: config.startTime,
        endTime: config.endTime,
        reason: config.createdReason || config.description || '',
      };
      await this.hospitalRepo.save(hospital);
    }

    this.logger.log(`严控模式已应用到 ${hospitals.length} 个院区`);
  }

  async enableConfig(id: string, operator: any): Promise<StrictModeConfig> {
    const config = await this.findConfigById(id);
    config.enabled = true;
    config.updatedBy = operator.userId;
    const saved = await this.strictModeRepo.save(config);
    await this.applyToHospitals(saved);
    return saved;
  }

  async disableConfig(id: string, operator: any): Promise<StrictModeConfig> {
    const config = await this.findConfigById(id);
    config.enabled = false;
    config.updatedBy = operator.userId;
    const saved = await this.strictModeRepo.save(config);

    if (config.hospitalId) {
      const hospital = await this.hospitalRepo.findOneBy({ id: config.hospitalId }) as Hospital;
      if (hospital) {
        hospital.strictModeConfig = { enabled: false, mode: '', startTime: null, endTime: null, reason: '' };
        await this.hospitalRepo.save(hospital);
      }
    }

    return saved;
  }

  async getGroupStrictModeStatus(): Promise<any> {
    const hospitals = await this.hospitalRepo.find({ where: { isDeleted: false } });
    const activeConfigs = await this.getActiveConfigs();

    const hospitalStatuses = hospitals.map(h => ({
      hospitalId: h.id,
      hospitalName: h.name,
      strictModeActive: h.strictModeConfig?.enabled || false,
      strictModeConfig: h.strictModeConfig,
    }));

    return {
      groupLevelConfigs: activeConfigs.filter(c => !c.hospitalId),
      hospitalLevelConfigs: activeConfigs.filter(c => c.hospitalId),
      hospitalStatuses,
      activeHospitalCount: hospitalStatuses.filter(s => s.strictModeActive).length,
      totalHospitalCount: hospitalStatuses.length,
    };
  }
}
