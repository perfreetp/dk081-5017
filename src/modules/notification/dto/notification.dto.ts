import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { NotificationTarget, NotificationChannel } from '../../../common/enums';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsEnum(NotificationTarget)
  targetType: NotificationTarget;

  @IsOptional()
  @IsString()
  targetName?: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  extraPayload?: Record<string, any>;
}

export class BatchNotifyDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsArray()
  targets: Array<{
    targetType: NotificationTarget;
    targetName?: string;
    targetUserId?: string;
    channel: NotificationChannel;
  }>;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  contentTemplate: string;

  @IsOptional()
  extraPayload?: Record<string, any>;
}

export class QueryNotificationDto {
  @IsOptional()
  eventId?: string;

  @IsOptional()
  targetType?: NotificationTarget;

  @IsOptional()
  targetUserId?: string;

  @IsOptional()
  channel?: NotificationChannel;

  @IsOptional()
  isRead?: boolean;

  @IsOptional()
  sendSuccess?: boolean;
}
