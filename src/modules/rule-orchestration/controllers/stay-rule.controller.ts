import { Controller, Get, Post, Put, Param, Query, Body, Req } from '@nestjs/common';
import { StayRuleService } from '../services/stay-rule.service';
import {
  CreateStayRuleDto,
  UpdateStayRuleDto,
  QueryStayRuleDto,
  SimulateRuleDto,
  BatchSimulateDto,
} from '../dto/stay-rule.dto';
import { PaginationDto, ApiResponseDto } from '../../../common/dto/common.dto';
import { ContextHelper } from '../../../common/middleware/context.middleware';

@Controller('api/stay-rules')
export class StayRuleController {
  constructor(private readonly stayRuleService: StayRuleService) {}

  @Get()
  async query(@Query() query: QueryStayRuleDto, @Query() pagination: PaginationDto) {
    const data = await this.stayRuleService.queryRules(query, pagination);
    return ApiResponseDto.success(data);
  }

  @Get('presets')
  async getScenePresets() {
    const data = await this.stayRuleService.getScenePresets();
    return ApiResponseDto.success(data);
  }

  @Get('match')
  async matchRule(
    @Query('areaId') areaId: string,
    @Query('hospitalId') hospitalId: string,
  ) {
    const data = await this.stayRuleService.matchRules(areaId, hospitalId);
    return ApiResponseDto.success(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.stayRuleService.findRuleById(id);
    return ApiResponseDto.success(data);
  }

  @Post()
  async create(@Body() dto: CreateStayRuleDto, @Req() req: any) {
    const data = await this.stayRuleService.createRule(dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '规则创建成功');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStayRuleDto, @Req() req: any) {
    const data = await this.stayRuleService.updateRule(id, dto, ContextHelper.get(req));
    return ApiResponseDto.success(data, '规则更新成功');
  }

  @Post('simulate')
  async simulate(@Body() dto: SimulateRuleDto) {
    const data = await this.stayRuleService.simulateMatch(
      dto.hospitalId,
      dto.areaId,
      new Date(dto.startTime),
      dto.durationSeconds,
    );
    return ApiResponseDto.success(data);
  }

  @Post('batch-simulate')
  async batchSimulate(@Body() dto: BatchSimulateDto) {
    const data = await this.stayRuleService.batchSimulate(dto.scenarios);
    return ApiResponseDto.success(
      data,
      `批量试算完成: 触发 ${data.triggered}/${data.total}, 严控模式下 ${data.strictTriggered} 条`,
    );
  }
}
