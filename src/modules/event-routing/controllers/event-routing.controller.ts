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
}
