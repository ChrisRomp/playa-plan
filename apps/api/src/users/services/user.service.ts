import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';
import { User as PrismaUser } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { normalizeEmail } from '../../common/utils/email.utils';

/**
 * Service for handling user related operations
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  // Fields that cannot be updated via the general update() method.
  // Auth-internal fields are included as defense-in-depth; they should only
  // be written by dedicated auth methods, never the general update path.
  private readonly protectedFields = [
    'id', 'createdAt', 'updatedAt',
    'verificationToken', 'resetToken', 'resetTokenExpiry',
    'loginCode', 'loginCodeExpiry',
    'isEmailVerified',
  ];

  /** Fields that updateProfile() is allowed to write. */
  private readonly profileFields = [
    'email', 'password', 'firstName', 'lastName', 'playaName',
    'phone', 'city', 'stateProvince', 'country',
    'emergencyContact', 'profilePicture',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Find all users in the system
   * @returns Array of users
   */
  async findAll(): Promise<PrismaUser[]> {
    return this.prisma.user.findMany();
  }

  /**
   * Find a user by their unique ID
   * @param id - User ID to find
   * @returns The user or null if not found
   */
  async findById(id: string): Promise<PrismaUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by email address
   * @param email - Email address to search for
   * @returns The user or null if not found
   */
  async findByEmail(email: string): Promise<PrismaUser | null> {
    const normalizedEmail = normalizeEmail(email);
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  /**
   * Create a new user
   * @param createUserDto - Data for creating the user
   * @returns The newly created user
   * @throws ConflictException if the email is already registered
   */
  async create(createUserDto: CreateUserDto): Promise<PrismaUser> {
    const { email, ...userData } = createUserDto;
    const normalizedEmail = normalizeEmail(email);
    
    // Check if user already exists
    const existingUser = await this.findByEmail(normalizedEmail);
    
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }
    
    // Create the user without password (auth is via email verification codes)
    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        ...userData,
      },
    });
  }

  /**
   * Update a user's profile fields (user-editable fields only).
   * Safe for any caller — admin-only fields are excluded by type.
   * @param id - ID of the user to update
   * @param updateProfileDto - Profile data to update
   * @returns The updated user
   * @throws NotFoundException if the user is not found
   * @throws ConflictException if trying to change email to one already registered
   */
  async updateProfile(id: string, updateProfileDto: UpdateProfileDto): Promise<PrismaUser> {
    // Runtime whitelist: only pass profile-safe fields regardless of what the caller provides
    const safeDto: Partial<UpdateProfileDto> = {};
    for (const key of this.profileFields) {
      const value = (updateProfileDto as Record<string, unknown>)[key];
      if (value !== undefined) {
        (safeDto as Record<string, unknown>)[key] = value;
      }
    }
    return this.performUpdate(id, safeDto as UpdateProfileDto);
  }

  /**
   * Update a user with admin-level fields (role, permission flags, and profile fields).
   * Only admin callers should invoke this method.
   * @param id - ID of the user to update
   * @param adminUpdateDto - Full update data including admin fields
   * @returns The updated user
   * @throws NotFoundException if the user is not found
   * @throws ConflictException if trying to change email to one already registered
   */
  async adminUpdateUser(id: string, adminUpdateDto: AdminUpdateUserDto): Promise<PrismaUser> {
    return this.performUpdate(id, adminUpdateDto);
  }

  /**
   * Shared update logic for both profile and admin update paths.
   * Strips protected fields, normalizes email, hashes password, and sends notifications.
   */
  private async performUpdate(id: string, dto: UpdateProfileDto | AdminUpdateUserDto): Promise<PrismaUser> {
    // Verify user exists
    const user = await this.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Store old email for notifications if email is being changed
    const oldEmail = user.email;
    const normalizedNewEmail = dto.email ? normalizeEmail(dto.email) : null;
    const isEmailChanging = normalizedNewEmail && normalizedNewEmail !== user.email;
    
    // If trying to update email, check if the new email is already in use
    if (isEmailChanging) {
      const existingUser = await this.findByEmail(normalizedNewEmail!);
      if (existingUser) {
        throw new ConflictException('Email address is already in use');
      }
    }
    
    // Create a clean update data object without protected fields
    const updateData: Partial<PrismaUser> = {};
    
    // Type safe way to iterate through DTO properties
    Object.keys(dto).forEach(key => {
      if (!this.protectedFields.includes(key)) {
        const value = (dto as Record<string, unknown>)[key];
        if (value !== undefined) {
          // Normalize email if it's being updated
          if (key === 'email' && typeof value === 'string') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updateData as any)[key] = normalizeEmail(value);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updateData as any)[key] = value;
          }
        }
      }
    });
    
    // Hash password if it's included in the update
    if (updateData.password) {
      updateData.password = await this.hashPassword(updateData.password);
    }
    
    // Perform the update
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });
    
    // Send email change notifications if email was changed
    if (isEmailChanging && normalizedNewEmail) {
      await this.sendEmailChangeNotifications(oldEmail, normalizedNewEmail, id);
    }
    
    return updatedUser;
  }

  /**
   * Send email change notifications to both old and new email addresses
   * @param oldEmail - Previous email address
   * @param newEmail - New email address
   * @param userId - User ID for audit trail
   */
  private async sendEmailChangeNotifications(oldEmail: string, newEmail: string, userId: string): Promise<void> {
    try {
      // Send notification to old email (non-blocking)
      this.notificationsService.sendEmailChangeNotificationToOldEmail(oldEmail, newEmail, userId)
        .catch(error => {
          this.logger.warn(`Failed to send email change notification to old email ${oldEmail}: ${error.message}`);
        });
      
      // Send notification to new email (non-blocking)
      this.notificationsService.sendEmailChangeNotificationToNewEmail(newEmail, oldEmail, userId)
        .catch(error => {
          this.logger.warn(`Failed to send email change notification to new email ${newEmail}: ${error.message}`);
        });
      
      this.logger.log(`Email change notifications sent for user ${userId}: ${oldEmail} -> ${newEmail}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Error sending email change notifications: ${err.message}`, err.stack);
      // Don't throw error - email notifications should not block user updates
    }
  }

  /**
   * Delete a user
   * @param id - ID of the user to delete
   * @returns The deleted user
   * @throws NotFoundException if the user is not found
   */
  async delete(id: string): Promise<PrismaUser> {
    // Verify user exists
    const user = await this.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Hash a password using bcrypt
   * @param password - Plain text password to hash
   * @returns Hashed password
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
}