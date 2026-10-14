import { IsInt, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

export class RestockDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
