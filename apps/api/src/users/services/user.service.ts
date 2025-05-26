import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { User as PrismaUser } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Service for handling user related operations
 */
@Injectable()
export class UserService {
  // Protected fields that cannot be updated directly
  private readonly protectedFields = ['id', 'createdAt', 'updatedAt'];

  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.user.findUnique({
      where: { email },
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
    
    // Check if user already exists
    const existingUser = await this.findByEmail(email);
    
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }
    
    // Create the user without password (auth is via email verification codes)
    return this.prisma.user.create({
      data: {
        email,
        ...userData,
      },
    });
  }

  /**
   * Update an existing user
   * @param id - ID of the user to update
   * @param updateUserDto - Data to update
   * @returns The updated user
   * @throws NotFoundException if the user is not found
   * @throws ConflictException if trying to change email to an email that's already registered
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<PrismaUser> {
    // Verify user exists
    const user = await this.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // If trying to update email, check if the new email is already in use
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('Email address is already in use');
      }
    }
    
    // Create a clean update data object without protected fields
    const updateData: Record<string, any> = {};
    
    // Type safe way to iterate through DTO properties
    Object.keys(updateUserDto).forEach(key => {
      if (!this.protectedFields.includes(key)) {
        // Use type assertion to tell TypeScript this is a valid key
        const typedKey = key as keyof UpdateUserDto;
        updateData[key] = updateUserDto[typedKey];
      }
    });
    
    // Hash password if it's included in the update
    if (updateData.password) {
      updateData.password = await this.hashPassword(updateData.password);
    }
    
    // Perform the update
    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
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