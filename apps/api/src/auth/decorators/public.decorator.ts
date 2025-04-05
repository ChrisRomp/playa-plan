import { SetMetadata } from '@nestjs/common';

/**
 * Key for public route metadata
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark routes as public (no authentication required)
 * Example usage: @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);