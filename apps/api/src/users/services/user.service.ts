import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Service for handling user related operations
 */
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all users in the system
   * @returns Array of users
   */
  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  /**
   * Find a user by their unique ID
   * @param id - User ID to find
   * @returns The user or null if not found
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by email address
   * @param email - Email address to search for
   * @returns The user or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
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
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, ...userData } = createUserDto;
    
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }
    
    // Hash the password
    const hashedPassword = await this.hashPassword(password);
    
    // Create the user
    return this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        ...userData,
      },
    });
  }

  /**
   * Update an existing user
   * @param id - ID of the user to update
   * @param updateData - Data to update
   * @returns The updated user
   * @throws NotFoundException if the user is not found
   */
  async update(id: string, updateData: Partial<User>): Promise<User> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Hash password if it's included in the update
    let dataToUpdate = { ...updateData };
    if (updateData.password) {
      dataToUpdate.password = await this.hashPassword(updateData.password);
    }
    
    // Remove fields that shouldn't be updated directly
    delete dataToUpdate.id;
    delete dataToUpdate.createdAt;
    delete dataToUpdate.updatedAt;
    
    return this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  /**
   * Delete a user
   * @param id - ID of the user to delete
   * @returns The deleted user
   * @throws NotFoundException if the user is not found
   */
  async delete(id: string): Promise<User> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
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