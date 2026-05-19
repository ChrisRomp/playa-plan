import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SAFE_USER_SELECT, SafeUser } from '../types/safe-user';

/**
 * JWT token payload interface
 */
interface JwtPayload {
  sub: string; // User ID
  email: string;
  /** RFC 8176 Authentication Methods References. Optional. */
  amr?: string[];
}

/**
 * JWT authentication strategy using Passport.js
 * Validates JWT tokens and extracts user information
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret = configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validates JWT token and retrieves user from database
   * @param payload JWT payload containing user information
   * @returns User object without auth-internal fields
   * @throws UnauthorizedException if user not found
   */
  async validate(payload: JwtPayload): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: SAFE_USER_SELECT,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    return user;
  }
}