import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsBoolean, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EventLevel, EventStatus, FalseAlarmCategory } from '../../../common/enums';

export class QueryEventDto {
  @IsOptional()
  hospitalId?: string;

  @IsOptional()
  buildingId?: string;

  @IsOptional()
  floorId?: string;

  @IsOptional()
  areaId?: string;

  @IsOptional()
  personId?: string;

  @IsOptional()
  @IsEnum(EventLevel)
  eventLevel?: EventLevel;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsBoolean()
  isKeyFocus?: boolean;

  @IsOptional()
  startTimeFrom?: Date;

  @IsOptional()
  startTimeTo?: Date;

  @IsOptional()
  keyword?: string;
}

export class DispatchEventDto {
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  assignedToName?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsArray()
  notificationTargets?: string[];
}

export class EscalateEventDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsEnum(EventLevel)
  targetLevel?: EventLevel;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  assignedToName?: string;
}

export class ProcessEventDto {
  @IsOptional()
  @IsString()
  remark?: string;
}

export class ResolveEventDto {
  @IsString()
  @IsNotEmpty()
  remark: string;
}

export class CloseEventDto {
  @IsOptional()
  @IsString()
  remark?: string;
}

export class MarkFalseAlarmDto {
  @IsEnum(FalseAlarmCategory)
  category: FalseAlarmCategory;

  @IsString()
  @IsNotEmpty()
  remark: string;
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  hospitalId: string;

  @IsString()
  @IsNotEmpty()
  buildingId: string;

  @IsString()
  @IsNotEmpty()
  floorId: string;

  @IsString()
  @IsNotEmpty()
  initialAreaId: string;

  @IsArray()
  involvedAreaIds: string[];

  @IsArray()
  involvedDeviceIds: string[];

  @IsOptional()
  @IsString()
  personId?: string;

  @IsEnum(EventLevel)
  eventLevel: EventLevel;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  matchedRuleId?: string;

  @IsOptional()
  @IsString()
  matchedRuleName?: string;

  @IsOptional()
  totalDurationSeconds?: number;

  @IsOptional()
  stayTimeline?: any[];

  @IsOptional()
  snapshots?: string[];

  @IsOptional()
  strictModeTriggered?: boolean;
}

export class BatchDispatchDto {
  @IsArray()
  @ArrayNotEmpty()
  eventIds: string[];

  @ValidateNested()
  @Type(() => DispatchEventDto)
  dispatch: DispatchEventDto;
}

export class BatchCloseDto {
  @IsArray()
  @ArrayNotEmpty()
  eventIds: string[];

  @ValidateNested()
  @Type(() => CloseEventDto)
  close: CloseEventDto;
}
