import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export class PaginatedResultDto<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;

  static create<T>(list: T[], total: number, page: number, pageSize: number): PaginatedResultDto<T> {
    return { list, total, page, pageSize };
  }
}

export class ApiResponseDto<T> {
  success: boolean;
  code: number;
  message: string;
  data?: T;

  static success<T>(data?: T, message = '操作成功'): ApiResponseDto<T> {
    return { success: true, code: 200, message, data };
  }

  static error(message = '操作失败', code = 500): ApiResponseDto<null> {
    return { success: false, code, message };
  }
}
