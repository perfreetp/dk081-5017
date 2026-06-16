import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Hospital,
  Building,
  Floor,
  Area,
  Device,
  Person,
  PersonStayRecord,
} from '../../infrastructure/entities';
import { HierarchyService } from './services/hierarchy.service';
import { DeviceService } from './services/device.service';
import {
  HospitalController,
  BuildingController,
  FloorController,
  AreaController,
  DeviceController,
  PersonController,
  StayRecordController,
} from './controllers/access-point.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hospital,
      Building,
      Floor,
      Area,
      Device,
      Person,
      PersonStayRecord,
    ]),
  ],
  providers: [HierarchyService, DeviceService],
  controllers: [
    HospitalController,
    BuildingController,
    FloorController,
    AreaController,
    DeviceController,
    PersonController,
    StayRecordController,
  ],
  exports: [HierarchyService, DeviceService],
})
export class AccessPointModule {}
