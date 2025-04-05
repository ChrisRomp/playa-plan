import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for local authentication strategy
 * Used for login endpoint to validate email/password
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}