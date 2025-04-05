import { Injectable, ConflictException, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

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
  ) {}

  /**
   * Validates user credentials for login
   * @param email User email
   * @param password User password
   * @returns User object without password if credentials are valid, null otherwise
   */
  async validateCredentials(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    try {
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      // Return null if user not found or password doesn't match
      if (!user || !user.password) {
        return null;
      }

      // Compare provided password with stored hash
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      // Return user without password
      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error(`Error validating user credentials: ${error.message}`);
      return null;
    }
  }

  /**
   * Registers a new user
   * @param registerDto Data for user registration
   * @returns Newly created user without password
   */
  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    const { email, password, firstName, lastName, playaName } = registerDto;

    // Check if user with the same email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    try {
      // Generate password hash
      const hashedPassword = await this.hashPassword(password);

      // Generate verification token
      const verificationToken = uuidv4();

      // Create new user
      const newUser = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          playaName,
          verificationToken,
          role: UserRole.PARTICIPANT,
        },
      });

      // Return user without password
      const { password: _, ...result } = newUser;
      return result;
    } catch (error) {
      this.logger.error(`Error during user registration: ${error.message}`);
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

      // Update user to mark email as verified
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          verificationToken: null,
        },
      });

      return true;
    } catch (error) {
      this.logger.error(`Error during email verification: ${error.message}`);
      return false;
    }
  }

  /**
   * Initiates password reset process
   * @param email User email
   * @returns True if reset token was generated, false otherwise
   */
  async initiatePasswordReset(email: string): Promise<boolean> {
    try {
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Return true even if user doesn't exist to prevent user enumeration
        return true;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24); // Token valid for 24 hours

      // Update user with reset token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });

      // TODO: Send email with reset link (will be implemented in notifications module)

      return true;
    } catch (error) {
      this.logger.error(`Error initiating password reset: ${error.message}`);
      return false;
    }
  }

  /**
   * Completes password reset process
   * @param token Reset token
   * @param newPassword New password
   * @returns True if password was reset, false otherwise
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Find user with the reset token that hasn't expired
      const user = await this.prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(), // Token must not be expired
          },
        },
      });

      if (!user) {
        return false;
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user with new password and clear reset token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      return true;
    } catch (error) {
      this.logger.error(`Error resetting password: ${error.message}`);
      return false;
    }
  }

  /**
   * Hashes a password
   * @param password Plain text password
   * @returns Hashed password
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}