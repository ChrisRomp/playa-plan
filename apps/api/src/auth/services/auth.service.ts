import { Injectable, ConflictException, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { User, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { randomInt } from 'crypto';
import { normalizeEmail } from '../../common/utils/email.utils';

/**
 * Authentication service responsible for user registration, login, and token management
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * This method is kept for compatibility with Passport.js local strategy 
   * but is not used in email verification flow
   * 
   * @param email User email
   * @returns null - we use email verification instead
   */
  // We use this signature to maintain compatibility with Passport local strategy
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateCredentials(email: string): Promise<null> {
    this.logger.warn(`validateCredentials called but we use email verification flow instead`);
    return null;
  }

  /**
   * Registers a new user
   * @param registerDto Data for user registration
   * @returns Newly created user
   */
  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    const { email, firstName, lastName, playaName } = registerDto;
    const normalizedEmail = normalizeEmail(email);

    try {
      // Check if user with this email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        this.logger.warn(`Registration failed: User with email ${normalizedEmail} already exists`);
        throw new ConflictException('User with this email already exists');
      }

      // Generate email verification token
      const verificationToken = uuidv4();

      // Create new user (always as PARTICIPANT initially - admin promotion happens on first authentication)
      const newUser = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          firstName,
          lastName,
          playaName,
          role: UserRole.PARTICIPANT,
          verificationToken: verificationToken,
        },
      });

      this.logger.log(`User registered: ${newUser.id}`);

      // Send verification email
      await this.sendVerificationEmail(newUser.email, verificationToken);

      // Return user data without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = newUser;
      return result;
    } catch (error: unknown) {
      this.logger.error(`Error during user registration: ${this.getErrorMessage(error)}`);
      
      // Re-throw HTTP exceptions (like ConflictException) as-is
      if (error instanceof HttpException) {
        throw error;
      }
      
      // For non-HTTP exceptions, wrap in BadRequestException
      throw new BadRequestException('User registration failed');
    }
  }

  /**
   * Logs in a user and generates a JWT token
   * @param user Authenticated user object
   * @returns Object containing user information and access token
   */
  async login(user: Omit<User, 'password'>): Promise<{ 
    accessToken: string; 
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }> {
    // Create JWT payload
    const payload = { 
      email: user.email, 
      sub: user.id,
      role: user.role,
    };

    // Generate JWT token
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  /**
   * Verifies a user's email using the verification token
   * @param token Verification token
   * @returns True if verification was successful, false otherwise
   */
  async verifyEmail(token: string): Promise<boolean> {
    try {
      // Find user with the verification token
      const user = await this.prisma.user.findFirst({
        where: { verificationToken: token },
      });

      if (!user) {
        return false;
      }

      // Check if this should be the first admin user (before marking as verified)
      const shouldBeAdmin = await this.shouldMakeFirstUserAdmin();

      // Update user to mark email as verified, potentially promoting to admin
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          verificationToken: null,
          // Promote to admin if this is the first user to authenticate
          ...(shouldBeAdmin && { role: UserRole.ADMIN }),
        },
      });

      if (shouldBeAdmin) {
        this.logger.log(`First user to authenticate promoted to ADMIN: ${user.id}`);
      }

      return true;
    } catch (error: unknown) {
      this.logger.error(`Error during email verification: ${this.getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Sends verification email to a user
   * @param email User email
   * @param token Verification token
   * @returns True if email was sent successfully
   */
  private async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    try {
      const normalizedEmail = normalizeEmail(email);
      // Try to get user ID for audit trail
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      
      const result = await this.notificationsService.sendEmailVerificationEmail(normalizedEmail, token, user?.id);
      if (!result) {
        this.logger.warn(`Failed to send verification email to ${normalizedEmail}`);
      }
      return result;
    } catch (error: unknown) {
      this.logger.error(`Error sending verification email: ${this.getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Generates a 6-digit login code for email verification login
   * Combined login/registration flow - will work for new or existing users
   * @param email User email
   * @returns True if login code was sent successfully, false otherwise
   */
  async generateLoginCode(email: string): Promise<boolean> {
    try {
      const normalizedEmail = normalizeEmail(email);
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      // We'll generate and send a code regardless of whether the user exists
      // This will handle both login and registration via the same flow

      // Generate a login code - use fixed code in development for easier testing
      const isDevelopment = this.configService.get<string>('nodeEnv') === 'development';
      const loginCode = isDevelopment 
        ? '123456' 
        : randomInt(100000, 1000000).toString(); // Cryptographically secure random 6-digit code
      
      if (isDevelopment) {
        this.logger.log(`Development mode: Using fixed login code '123456' for ${normalizedEmail}`);
      }
      
      // Set expiry time (15 minutes from now)
      const loginCodeExpiry = new Date();
      loginCodeExpiry.setMinutes(loginCodeExpiry.getMinutes() + 15);

      // If user exists, update with login code
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            loginCode,
            loginCodeExpiry,
          },
        });
      } else {
        // If user doesn't exist, create a new user with the login code
        // This creates a minimal user record that will be completed after verification
        
        await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            loginCode,
            loginCodeExpiry,
            role: UserRole.PARTICIPANT, // Always PARTICIPANT initially - admin promotion happens on authentication
            firstName: '', // These will be updated after verification
            lastName: '', // These will be updated after verification
            isEmailVerified: false,
          },
        });
        
        this.logger.log(`Created new user with email: ${normalizedEmail} (pending verification)`);
      }

      // Send login code email
      await this.sendLoginCodeEmail(normalizedEmail, loginCode);

      return true;
    } catch (error: unknown) {
      this.logger.error(`Error generating login code: ${this.getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Sends login code email to a user
   * @param email User email
   * @param code Login code
   * @returns True if email was sent successfully
   */
  private async sendLoginCodeEmail(email: string, code: string): Promise<boolean> {
    try {
      const normalizedEmail = normalizeEmail(email);
      // Try to get user ID for audit trail
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      
      const result = await this.notificationsService.sendLoginCodeEmail(normalizedEmail, code, user?.id);
      if (!result) {
        this.logger.warn(`Failed to send login code email to ${normalizedEmail}`);
      }
      return result;
    } catch (error: unknown) {
      this.logger.error(`Error sending login code email: ${this.getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Validates login code for email verification login
   * Combined login/registration flow - creates a new user if one doesn't exist
   * @param email User email
   * @param code Login code
   * @returns User object if code is valid, null otherwise
   */
  async validateLoginCode(email: string, code: string): Promise<Omit<User, 'password'> | null> {
    try {
      const now = new Date();
      const normalizedEmail = normalizeEmail(email);

      // Step 1: Find user with matching email and authorization code
      let user = await this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          loginCode: code,
          loginCodeExpiry: {
            gt: now,
          },
        },
      });

      if (!user) {
        // Invalid or expired code
        return null;
      }

      // Step 2: Check if this should be the first admin user (before marking as verified)
      const shouldBeAdmin = await this.shouldMakeFirstUserAdmin();

      // Step 3: Clear the login code and mark as verified, potentially promoting to admin
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginCode: null,
          loginCodeExpiry: null,
          isEmailVerified: true,
          // Promote to admin if this is the first user to authenticate
          ...(shouldBeAdmin && { role: UserRole.ADMIN }),
        },
      });

      if (shouldBeAdmin) {
        this.logger.log(`First user to authenticate promoted to ADMIN: ${updatedUser.id}`);
      }

      // Return user without password field
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = updatedUser;
      return result;
    } catch (error: unknown) {
      this.logger.error(`Error validating login code: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Safely get error message from any error type
   * @param error The error to extract a message from
   * @returns A string representation of the error
   */
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Determines if a new user should be made an admin
   * This happens when there are no authenticated users yet (first user to actually log in)
   * @returns True if the new user should be an admin, false otherwise
   */
  private async shouldMakeFirstUserAdmin(): Promise<boolean> {
    try {
      // Check if there are any users who have successfully authenticated
      // (either verified their email or completed login code verification)
      const authenticatedUserCount = await this.prisma.user.count({
        where: {
          isEmailVerified: true,
        },
      });
      
      return authenticatedUserCount === 0;
    } catch (error: unknown) {
      this.logger.error(`Error checking authenticated user count: ${this.getErrorMessage(error)}`);
      return false;
    }
  }
}