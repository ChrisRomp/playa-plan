import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

/**
 * Query parameters for filtering and paginating payments.
 */
export class FindPaymentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  take?: number;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  registrationId?: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  year?: number;
}
