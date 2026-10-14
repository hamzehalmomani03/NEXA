import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  productId: string;

  @IsIn(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'])
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
