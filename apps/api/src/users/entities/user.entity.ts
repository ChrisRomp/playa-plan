import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { UserRole } from '@prisma/client';

/**
 * Entity representing a user in the system
 * Maps to the User model in Prisma
 */
export class User {
  @ApiProperty({ description: 'Unique identifier for the user' })
  id: string = '';

  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  email: string = '';

  @ApiProperty({ description: 'User first name', example: 'John' })
  firstName: string = '';

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  lastName: string = '';

  @ApiProperty({ description: 'User playa name (optional)', example: 'Dusty', required: false })
  playaName?: string | null;

  @ApiProperty({ description: 'URL to user profile picture (optional)', required: false })
  profilePicture?: string | null;

  @ApiProperty({ enum: UserRole, description: 'User role in the system', default: UserRole.PARTICIPANT })
  role: UserRole = UserRole.PARTICIPANT;

  @ApiProperty({ description: 'Flag indicating if email is verified', default: false })
  isEmailVerified: boolean = false;

  @Exclude()
  verificationToken?: string | null;

  @Exclude()
  password?: string | null;
  
  @Exclude()
  resetToken?: string | null;
  
  @Exclude()
  resetTokenExpiry?: Date | null;

  @ApiProperty({ description: 'When the user was created' })
  createdAt: Date = new Date();

  @ApiProperty({ description: 'When the user was last updated' })
  updatedAt: Date = new Date();

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }

  /**
   * Returns the full name of the user
   */
  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Returns the display name (playa name if available, otherwise full name)
   */
  getDisplayName(): string {
    return this.playaName || this.getFullName();
  }

  /**
   * Checks if the user has the specified role
   */
  hasRole(role: UserRole): boolean {
    return this.role === role;
  }

  /**
   * Checks if the user is an administrator
   */
  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  /**
   * Checks if the user is a staff member (includes admins)
   */
  isStaff(): boolean {
    return this.role === UserRole.STAFF || this.role === UserRole.ADMIN;
  }
}