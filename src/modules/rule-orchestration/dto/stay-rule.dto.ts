import { IsString, IsNotEmpty, IsOptional, MaxLength, IsInt, Min, IsArray, IsBoolean, IsEnum } from 'class-validator';
import { EventLevel, SensitivityLevel, SceneType } from '../../../common/enums';

export class CreateTimeSlotDto {
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsArray()
  weekdays: number[];

  @IsEnum(SensitivityLevel)
  sensitivityLevel: SensitivityLevel;

  @IsOptional()
  @IsInt()
  overrideMaxStaySeconds?: number;

  @IsOptional()
  @IsEnum(EventLevel)
  overrideEventLevel?: EventLevel;
}

export class CreateStayRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsEnum(SceneType)
  sceneType?: SceneType;

  @IsEnum(EventLevel)
  eventLevel: EventLevel;

  @IsInt()
  @Min(1)
  maxStaySeconds: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  warningStaySeconds?: number;

  @IsOptional()
  @IsEnum(SensitivityLevel)
  defaultSensitivity?: SensitivityLevel;

  @IsArray()
  notificationTargets: string[];

  @IsOptional()
  @IsBoolean()
  mergeSamePerson?: boolean;

  @IsOptional()
  @IsInt()
  mergeTimeWindowSeconds?: number;

  @IsOptional()
  @IsBoolean()
  applyToStrictMode?: boolean;

  @IsOptional()
  strictModeOverride?: {
    maxStaySeconds: number;
    eventLevel: EventLevel;
    sensitivity: SensitivityLevel;
  };

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  timeSlotSensitivities?: CreateTimeSlotDto[];
}

export class UpdateStayRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EventLevel)
  eventLevel?: EventLevel;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStaySeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  warningStaySeconds?: number;

  @IsOptional()
  @IsEnum(SensitivityLevel)
  defaultSensitivity?: SensitivityLevel;

  @IsOptional()
  @IsArray()
  notificationTargets?: string[];

  @IsOptional()
  @IsBoolean()
  mergeSamePerson?: boolean;

  @IsOptional()
  @IsInt()
  mergeTimeWindowSeconds?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  timeSlotSensitivities?: CreateTimeSlotDto[];
}

export class QueryStayRuleDto {
  @IsOptional()
  hospitalId?: string;

  @IsOptional()
  areaId?: string;

  @IsOptional()
  sceneType?: SceneType;

  @IsOptional()
  eventLevel?: EventLevel;

  @IsOptional()
  keyword?: string;

  @IsOptional()
  enabled?: boolean;
}

export class MatchedRuleResult {
  ruleId: string;
  ruleName: string;
  maxStaySeconds: number;
  warningStaySeconds: number;
  eventLevel: EventLevel;
  sensitivity: SensitivityLevel;
  notificationTargets: string[];
  mergeSamePerson: boolean;
  mergeTimeWindowSeconds: number;
  isStrictModeApplied: boolean;
}

export class SimulateRuleDto {
  @IsString()
  @IsNotEmpty()
  hospitalId: string;

  @IsString()
  @IsNotEmpty()
  areaId: string;

  @IsNotEmpty()
  startTime: Date;

  @IsInt()
  @Min(1)
  durationSeconds: number;
}
