import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { IsOptionalNonNullable } from '../../../../../libs/utils/customDecorator/isOptionalNonNullable';

export class PaginatorDTO {
  @IsOptionalNonNullable()
  @Transform((params: TransformFnParams) => parseInt(params.value, 10))
  @IsNumber()
  @ApiProperty({
    required: false,
    type: Number,
    example: 1,
  })
  page?: number;

  @IsOptionalNonNullable()
  @Transform((params: TransformFnParams) => parseInt(params.value, 10))
  @IsNumber()
  @ApiProperty({
    required: false,
    type: Number,
    example: 10,
  })
  limit?: number;
}
