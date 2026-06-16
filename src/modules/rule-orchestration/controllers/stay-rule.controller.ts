import { Controller, Get, Post, Put, Param, Query, Body, Req } from '@nestjs/common';
import { StayRuleService } from '../services/stay-rule.service';
import {
  CreateStayRuleDto,
  UpdateStayRuleDto,
  QueryStayRuleDto,
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
}
