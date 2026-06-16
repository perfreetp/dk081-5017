import { Controller, Get, Post, Put, Param, Query, Body } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import {
  CreateNotificationDto,
  BatchNotifyDto,
  QueryNotificationDto,
} from '../dto/notification.dto';
import { PaginationDto, ApiResponseDto } from '../../../common/dto/common.dto';
import { NotificationTarget } from '../../../common/enums';

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async query(@Query() query: QueryNotificationDto, @Query() pagination: PaginationDto) {
    const data = await this.notificationService.queryNotifications(query, pagination);
    return ApiResponseDto.success(data);
  }

  @Get('stats')
  async getStats(
    @Query('targetUserId') targetUserId?: string,
    @Query('targetType') targetType?: NotificationTarget,
  ) {
    const data = await this.notificationService.getNotificationStats(targetUserId, targetType);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.notificationService.findNotificationById(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateNotificationDto) {
    const data = await this.notificationService.createNotification(dto);
    return ApiResponseDto.success(data, '通知创建成功');
  }

  @Post('batch')
  async batchNotify(@Body() dto: BatchNotifyDto) {
    const data = await this.notificationService.batchNotify(dto);
    return ApiResponseDto.success(data, '批量通知发送成功');
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string) {
    const data = await this.notificationService.markAsRead(id);
    return ApiResponseDto.success(data);
  }

  @Put('read-all/:targetUserId')
  async markAllAsRead(@Param('targetUserId') targetUserId: string) {
    const count = await this.notificationService.markAllAsRead(targetUserId);
    return ApiResponseDto.success({ count }, `已标记 ${count} 条通知为已读`);
  }

  @Put(':id/retry')
  async retry(@Param('id') id: string) {
    const data = await this.notificationService.retryNotification(id);
    return ApiResponseDto.success(data, '通知重发成功');
  }
}
