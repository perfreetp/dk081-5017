import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { HierarchyService } from '../services/hierarchy.service';
import { DeviceService } from '../services/device.service';
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
import {
  CreateDeviceDto,
  UpdateDeviceDto,
  QueryDeviceDto,
  CreatePersonDto,
  CreateStayRecordDto,
} from '../dto/device.dto';
import { PaginationDto, ApiResponseDto } from '../../../common/dto/common.dto';
import { ContextHelper } from '../../../common/middleware/context.middleware';

@Controller('api/hospitals')
export class HospitalController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  @Get()
  async findAll() {
    const data = await this.hierarchyService.findAllHospitals();
    return ApiResponseDto.success(data);
  }

  @Get('hierarchy')
  async getFullHierarchy() {
    const data = await this.hierarchyService.getFullHierarchy();
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.hierarchyService.findHospitalById(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateHospitalDto, @Req() req: any) {
    const data = await this.hierarchyService.createHospital(dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '院区创建成功');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateHospitalDto, @Req() req: any) {
    const data = await this.hierarchyService.updateHospital(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '院区更新成功');
  }
}

@Controller('api/buildings')
export class BuildingController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  @Get()
  async findByHospital(@Query('hospitalId') hospitalId: string) {
    const data = await this.hierarchyService.findBuildingsByHospital(hospitalId);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.hierarchyService.findBuildingById(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateBuildingDto, @Req() req: any) {
    const data = await this.hierarchyService.createBuilding(dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '楼栋创建成功');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBuildingDto, @Req() req: any) {
    const data = await this.hierarchyService.updateBuilding(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '楼栋更新成功');
  }
}

@Controller('api/floors')
export class FloorController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  @Get()
  async findByBuilding(@Query('buildingId') buildingId: string) {
    const data = await this.hierarchyService.findFloorsByBuilding(buildingId);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.hierarchyService.findFloorById(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateFloorDto, @Req() req: any) {
    const data = await this.hierarchyService.createFloor(dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '楼层创建成功');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateFloorDto, @Req() req: any) {
    const data = await this.hierarchyService.updateFloor(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '楼层更新成功');
  }
}

@Controller('api/areas')
export class AreaController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  @Get()
  async query(@Query() query: QueryAreaDto, @Query() pagination: PaginationDto) {
    const data = await this.hierarchyService.queryAreas(query, pagination);
    return ApiResponseDto.success(data);
  }

  @Get('by-floor/:floorId')
  async findByFloor(@Param('floorId') floorId: string) {
    const data = await this.hierarchyService.findAreasByFloor(floorId);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.hierarchyService.findAreaById(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateAreaDto, @Req() req: any) {
    const data = await this.hierarchyService.createArea(dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '区域创建成功');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAreaDto, @Req() req: any) {
    const data = await this.hierarchyService.updateArea(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '区域更新成功');
  }
}

@Controller('api/devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  async query(@Query() query: QueryDeviceDto, @Query() pagination: PaginationDto) {
    const data = await this.deviceService.queryDevices(query, pagination);
    return ApiResponseDto.success(data);
  }

  @Get('stats')
  async getStats(@Query('hospitalId') hospitalId?: string) {
    const data = await this.deviceService.getDeviceStats(hospitalId);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.deviceService.findDeviceById(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateDeviceDto, @Req() req: any) {
    const data = await this.deviceService.createDevice(dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '设备创建成功');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDeviceDto, @Req() req: any) {
    const data = await this.deviceService.updateDevice(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '设备更新成功');
  }
}

@Controller('api/persons')
export class PersonController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  async createOrUpdate(@Body() dto: CreatePersonDto) {
    const data = await this.deviceService.createOrUpdatePerson(dto);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.deviceService.findPersonById(id);
    return ApiResponseDto.success(data);
  }
}

@Controller('api/stay-records')
export class StayRecordController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  async report(@Body() dto: CreateStayRecordDto) {
    const data = await this.deviceService.reportStayRecord(dto);
    return ApiResponseDto.success(data, '停留记录上报成功');
  }

  @Put(':id/end')
  async endStay(@Param('id') id: string, @Body() body: { endTime: Date; durationSeconds: number }) {
    const data = await this.deviceService.updateStayRecordEndTime(id, body.endTime, body.durationSeconds);
    return ApiResponseDto.success(data, '停留记录结束');
  }
}
