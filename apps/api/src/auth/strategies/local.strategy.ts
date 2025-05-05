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
   * This method is needed by the Passport local strategy, but in our email verification flow,
   * users authenticate via email verification codes instead of passwords.
   * 
   * @param email User email
   * @param password Password parameter is required by Passport but not used
   * @returns Null - this method always throws as we use email verification instead
   * @throws UnauthorizedException indicating we use email verification flow
   */
  async validate(email: string, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    password: string
  ): Promise<never> {
    // Call validateCredentials with only email parameter
    await this.authService.validateCredentials(email);
    
    // Our validateCredentials always returns null as we use email verification flow
    throw new UnauthorizedException('Please use email verification flow to authenticate');
  }
}