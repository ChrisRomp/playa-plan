import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';

/**
 * Local authentication strategy using Passport.js
 * Validates user credentials (email and password)
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  /**
   * Validates user credentials
   * @param email User email
   * @param password User password
   * @returns Authenticated user
   * @throws UnauthorizedException if credentials are invalid
   */
  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}