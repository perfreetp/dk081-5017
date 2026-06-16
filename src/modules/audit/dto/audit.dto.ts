import { IsString, IsOptional, IsEnum } from 'class-validator';
import { FalseAlarmCategory, StrictModeType } from '../../../common/enums';

export class QueryAuditLogDto {
  @IsOptional()
  hospitalId?: string;

  @IsOptional()
  eventId?: string;

  @IsOptional()
  userId?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  startTime?: Date;

  @IsOptional()
  endTime?: Date;

  @IsOptional()
  keyword?: string;
}

export class CreateStrictModeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(StrictModeType)
  modeType: StrictModeType;

  @IsOptional()
  hospitalId?: string;

  scopeHospitalIds?: string[];

  startTime: Date;
  endTime: Date;

  sensitivityMultiplier?: number;

  ruleOverrides?: Array<{
    ruleId: string;
    maxStaySeconds: number;
    eventLevel: string;
  }>;

  forcedNotificationTargets?: string[];

  @IsOptional()
  createdReason?: string;
}

export class UpdateStrictModeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  startTime?: Date;
  endTime?: Date;

  sensitivityMultiplier?: number;

  @IsOptional()
  enabled?: boolean;
}

export class QueryFalseAlarmStatDto {
  @IsOptional()
  hospitalId?: string;

  @IsOptional()
  category?: FalseAlarmCategory;

  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;
}

export class QueryReportDto {
  @IsOptional()
  hospitalId?: string;

  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;

  @IsOptional()
  groupBy?: 'day' | 'week' | 'month' | 'hospital';
}
