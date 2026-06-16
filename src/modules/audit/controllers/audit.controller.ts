import { Controller, Get, Post, Put, Param, Query, Body, Req } from '@nestjs/common';
import { AuditService } from '../services/audit.service';
import { ReportService } from '../services/report.service';
import { StrictModeService } from '../services/strict-mode.service';
import {
  QueryAuditLogDto,
  CreateStrictModeDto,
  UpdateStrictModeDto,
  QueryFalseAlarmStatDto,
  QueryReportDto,
} from '../dto/audit.dto';
import { PaginationDto, ApiResponseDto } from '../../../common/dto/common.dto';
import { ContextHelper } from '../../../common/middleware/context.middleware';

@Controller('api/audit-logs')
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async query(@Query() query: QueryAuditLogDto, @Query() pagination: PaginationDto) {
    const data = await this.auditService.queryLogs(query, pagination);
    return ApiResponseDto.success(data);
  }
}

@Controller('api/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('rule-hit-rate')
  async getRuleHitRate(@Query() query: QueryReportDto) {
    const data = await this.reportService.getRuleHitRateReport(query);
    return ApiResponseDto.success(data);
  }

  @Get('handling-duration')
  async getHandlingDuration(@Query() query: QueryReportDto) {
    const data = await this.reportService.getHandlingDurationReport(query);
    return ApiResponseDto.success(data);
  }

  @Get('escalation-rate')
  async getEscalationRate(@Query() query: QueryReportDto) {
    const data = await this.reportService.getEscalationRateReport(query);
    return ApiResponseDto.success(data);
  }

  @Get('trend')
  async getTrend(@Query() query: QueryReportDto) {
    const data = await this.reportService.getTrendReport(query);
    return ApiResponseDto.success(data);
  }

  @Get('dashboard')
  async getGroupDashboard(@Query() query: QueryReportDto) {
    const data = await this.reportService.getGroupDashboard(query);
    return ApiResponseDto.success(data);
  }
}

@Controller('api/false-alarm-stats')
export class FalseAlarmController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getStatistics(@Query() query: QueryFalseAlarmStatDto) {
    const data = await this.auditService.getFalseAlarmStatistics(query);
    return ApiResponseDto.success(data);
  }
}

@Controller('api/strict-modes')
export class StrictModeController {
  constructor(private readonly strictModeService: StrictModeService) {}

  @Get()
  async query(@Query('hospitalId') hospitalId?: string, @Query() pagination?: PaginationDto) {
    const data = await this.strictModeService.queryConfigs(hospitalId, pagination);
    return ApiResponseDto.success(data);
  }

  @Get('active')
  async getActive(@Query('hospitalId') hospitalId?: string) {
    const data = await this.strictModeService.getActiveConfigs(hospitalId);
    return ApiResponseDto.success(data);
  }

  @Get('hospital-status')
  async checkHospitalStatus(@Query('hospitalId') hospitalId: string) {
    const data = await this.strictModeService.checkHospitalStrictMode(hospitalId);
    return ApiResponseDto.success(data);
  }

  @Get('group-status')
  async getGroupStatus() {
    const data = await this.strictModeService.getGroupStrictModeStatus();
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.strictModeService.findConfigById(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateStrictModeDto, @Req() req: any) {
    const data = await this.strictModeService.createConfig(dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '严控模式创建成功');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStrictModeDto, @Req() req: any) {
    const data = await this.strictModeService.updateConfig(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '严控模式更新成功');
  }

  @Put(':id/enable')
  async enable(@Param('id') id: string, @Req() req: any) {
    const data = await this.strictModeService.enableConfig(id, ContextHelper.get(req));
    return ApiResponseDto.success(data, '严控模式已启用');
  }

  @Put(':id/disable')
  async disable(@Param('id') id: string, @Req() req: any) {
    const data = await this.strictModeService.disableConfig(id, ContextHelper.get(req));
    return ApiResponseDto.success(data, '严控模式已停用');
  }
}
