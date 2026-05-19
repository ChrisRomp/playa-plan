import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UpdateProfileDto } from './update-profile.dto';

/**
 * Data Transfer Object for admin-level user updates.
 * Extends UpdateProfileDto with admin-only permission flags and role.
 * Only admin callers should use this DTO.
 */
export class AdminUpdateUserDto extends UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Whether the user is allowed to register for camps',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  readonly allowRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed early registration',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  readonly allowEarlyRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed to defer dues payment',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  readonly allowDeferredDuesPayment?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed to skip job assignments',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  readonly allowNoJob?: boolean;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  readonly role?: UserRole;
}
