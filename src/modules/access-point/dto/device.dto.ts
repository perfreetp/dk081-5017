import { IsString, IsNotEmpty, IsOptional, MaxLength, IsBoolean, IsEnum } from 'class-validator';
import { DeviceType, DeviceStatus } from '../../../common/enums';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsEnum(DeviceType)
  deviceType: DeviceType;

  @IsString()
  @IsNotEmpty()
  areaId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  extraConfig?: Record<string, any>;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ipAddress?: string;

  @IsOptional()
  extraConfig?: Record<string, any>;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class QueryDeviceDto {
  @IsOptional()
  hospitalId?: string;

  @IsOptional()
  buildingId?: string;

  @IsOptional()
  floorId?: string;

  @IsOptional()
  areaId?: string;

  @IsOptional()
  @IsEnum(DeviceType)
  deviceType?: DeviceType;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  keyword?: string;
}

export class CreatePersonDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  personId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  faceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  idCardNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeNo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  personType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  extraInfo?: Record<string, any>;
}

export class CreateStayRecordDto {
  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsNotEmpty()
  startTime: Date;

  @IsOptional()
  endTime?: Date;

  @IsOptional()
  durationSeconds?: number;

  @IsOptional()
  snapshots?: string[];
}
