import { Controller, Get, Post, Put, Param, Query, Body, Req } from '@nestjs/common';
import { EventRoutingService } from '../services/event-routing.service';
import {
  QueryEventDto,
  DispatchEventDto,
  EscalateEventDto,
  ProcessEventDto,
  ResolveEventDto,
  CloseEventDto,
  MarkFalseAlarmDto,
  CreateEventDto,
  BatchDispatchDto,
  BatchCloseDto,
} from '../dto/event.dto';
import { PaginationDto, ApiResponseDto } from '../../../common/dto/common.dto';
import { ContextHelper } from '../../../common/middleware/context.middleware';

@Controller('api/events')
export class EventRoutingController {
  constructor(private readonly eventService: EventRoutingService) {}

  @Get()
  async query(@Query() query: QueryEventDto, @Query() pagination: PaginationDto) {
    const data = await this.eventService.queryEvents(query, pagination);
    return ApiResponseDto.success(data);
  }

  @Get('stats')
  async getStats(
    @Query('hospitalId') hospitalId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.eventService.getEventStats(
      hospitalId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.eventService.findEventById(id);
    return ApiResponseDto.success(data);
  }

  @Get(':id/trails')
  async getTrails(@Param('id') id: string) {
    const data = await this.eventService.getEventFlowTrails(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateEventDto, @Req() req: any) {
    const data = await this.eventService.createEvent(dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '事件创建成功');
  }

  @Post('process-stay-records')
  async processStayRecords() {
    const data = await this.eventService.processStayRecords();
    return ApiResponseDto.success(data, '停留记录处理完成');
  }

  @Put(':id/dispatch')
  async dispatch(@Param('id') id: string, @Body() dto: DispatchEventDto, @Req() req: any) {
    const data = await this.eventService.dispatchEvent(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '派单成功');
  }

  @Put(':id/start-processing')
  async startProcessing(@Param('id') id: string, @Body() dto: ProcessEventDto, @Req() req: any) {
    const data = await this.eventService.startProcessing(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '开始处置');
  }

  @Put(':id/escalate')
  async escalate(@Param('id') id: string, @Body() dto: EscalateEventDto, @Req() req: any) {
    const data = await this.eventService.escalateEvent(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '已升级为重点关注事件');
  }

  @Put(':id/resolve')
  async resolve(@Param('id') id: string, @Body() dto: ResolveEventDto, @Req() req: any) {
    const data = await this.eventService.resolveEvent(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '事件已处置');
  }

  @Put(':id/close')
  async close(@Param('id') id: string, @Body() dto: CloseEventDto, @Req() req: any) {
    const data = await this.eventService.closeEvent(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '事件已关闭');
  }

  @Put(':id/false-alarm')
  async markFalseAlarm(@Param('id') id: string, @Body() dto: MarkFalseAlarmDto, @Req() req: any) {
    const data = await this.eventService.markFalseAlarm(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '已标记为误报');
  }

  @Get(':id/analysis')
  async getAnalysis(@Param('id') id: string) {
    const data = await this.eventService.getEventAnalysis(id);
    return ApiResponseDto.success(data);
  }

  @Get('by-no/:eventNo/analysis')
  async getAnalysisByNo(@Param('eventNo') eventNo: string) {
    const data = await this.eventService.getEventAnalysisByNo(eventNo);
    return ApiResponseDto.success(data);
  }

  @Get(':id/export-review')
  async exportReview(@Param('id') id: string) {
    const data = await this.eventService.exportEventReview(id);
    return ApiResponseDto.success(data, '复盘数据导出成功');
  }

  @Get('by-no/:eventNo/export-review')
  async exportReviewByNo(@Param('eventNo') eventNo: string) {
    const data = await this.eventService.exportEventReviewByNo(eventNo);
    return ApiResponseDto.success(data, '复盘数据导出成功');
  }

  @Get('review-report')
  async reviewReport(
    @Query('hospitalId') hospitalId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.eventService.getReviewReport(
      hospitalId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return ApiResponseDto.success(data, '复盘报告生成成功');
  }

  @Get('supervision/list')
  async supervisionList(
    @Query('hospitalId') hospitalId?: string,
    @Query('viewType') viewType?: 'all' | 'pending_dispatch_timeout' | 'process_timeout' | 'strict_unclosed',
    @Query('dispatchTimeoutMinutes') dispatchTimeoutMinutes?: string,
    @Query('processTimeoutMinutes') processTimeoutMinutes?: string,
    @Query() pagination?: PaginationDto,
  ) {
    const data = await this.eventService.getSupervisionList(
      hospitalId,
      (viewType as any) || 'all',
      dispatchTimeoutMinutes ? parseInt(dispatchTimeoutMinutes, 10) : 30,
      processTimeoutMinutes ? parseInt(processTimeoutMinutes, 10) : 120,
      pagination,
    );
    return ApiResponseDto.success(data);
  }

  @Get('supervision/stats')
  async supervisionStats(
    @Query('hospitalId') hospitalId?: string,
    @Query('dispatchTimeoutMinutes') dispatchTimeoutMinutes?: string,
    @Query('processTimeoutMinutes') processTimeoutMinutes?: string,
  ) {
    const data = await this.eventService.getSupervisionStats(
      hospitalId,
      dispatchTimeoutMinutes ? parseInt(dispatchTimeoutMinutes, 10) : 30,
      processTimeoutMinutes ? parseInt(processTimeoutMinutes, 10) : 120,
    );
    return ApiResponseDto.success(data);
  }

  @Get('supervision/assignee/:assignee/list')
  async assigneeEventList(
    @Param('assignee') assignee: string,
    @Query('hospitalId') hospitalId?: string,
    @Query() pagination?: PaginationDto,
  ) {
    const data = await this.eventService.getAssigneeEventList(assignee, hospitalId, pagination);
    return ApiResponseDto.success(data);
  }

  @Post('batch-dispatch')
  async batchDispatch(@Body() dto: BatchDispatchDto, @Req() req: any) {
    const data = await this.eventService.batchDispatchEvents(
      dto.eventIds,
      dto.dispatch,
      ContextHelper.get(req),
    );
    return ApiResponseDto.success(
      data,
      `批量派单: 成功${data.succeeded.length}条, 失败${data.failed.length}条`,
    );
  }

  @Post('batch-close')
  async batchClose(@Body() dto: BatchCloseDto, @Req() req: any) {
    const data = await this.eventService.batchCloseEvents(
      dto.eventIds,
      dto.close,
      ContextHelper.get(req),
    );
    return ApiResponseDto.success(
      data,
      `批量关闭: 成功${data.succeeded.length}条, 失败${data.failed.length}条`,
    );
  }
}
