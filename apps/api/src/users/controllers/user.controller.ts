import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Put,
  UnauthorizedException,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SelfOrAdminGuard } from '../guards/self-or-admin.guard';
import { UserTransformInterceptor } from '../interceptors/user-transform.interceptor';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { User } from '../entities/user.entity';

/**
 * Type definition for authenticated request
 */
interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

/**
 * Controller for handling user-related HTTP requests
 */
@ApiTags('users')
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get all users
   * Admin and staff can see all users
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns all users',
    type: User,
    isArray: true
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  async findAll(@Request() req: AuthRequest): Promise<User[]> {
    const users = await this.userService.findAll();
    return users.map(user => new User(user));
  }

  /**
   * Get user by ID
   * Users can only access their own profile
   * Admin and staff can access any profile
   */
  @Get(':id')
  @UseGuards(SelfOrAdminGuard)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the user',
    type: User
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  async findById(@Param('id') id: string): Promise<User> {
    const user = await this.userService.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return new User(user);
  }

  /**
   * Get the current authenticated user
   */
  @Get('me/profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the current authenticated user',
    type: User
  })
  async getProfile(@Request() req: AuthRequest): Promise<User> {
    const user = await this.userService.findById(req.user.id);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    return new User(user);
  }

  /**
   * Create a new user
   * Admin can create users with any role
   * Others can only create PARTICIPANT users
   */
  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ 
    status: 201, 
    description: 'User created successfully',
    type: User
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  async create(@Body() createUserDto: CreateUserDto, @Request() req: AuthRequest): Promise<User> {
    // Only admins can create users with roles other than PARTICIPANT
    if (createUserDto.role && createUserDto.role !== UserRole.PARTICIPANT) {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only administrators can create users with elevated privileges');
      }
    }

    const user = await this.userService.create(createUserDto);
    return new User(user);
  }

  /**
   * Update a user
   * Users can only update their own profile
   * Staff can update participant profiles
   * Admin can update any profile
   */
  @Put(':id')
  @UseGuards(SelfOrAdminGuard)
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'User updated successfully',
    type: User
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: AuthRequest
  ): Promise<User> {
    // First check if the user exists
    const userExists = await this.userService.findById(id);
    if (!userExists) {
      throw new NotFoundException('User not found');
    }
    
    // Staff can only update participants or their own account, not other staff or admins
    if (req.user && req.user.role === UserRole.STAFF) {
      if (userExists.role !== UserRole.PARTICIPANT && req.user.id !== id) {
        throw new ForbiddenException('Staff cannot update other staff or admin accounts');
      }
    }

    // Only admins can update user roles
    if (updateUserDto.role && req.user && req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can change user roles');
    }

    const updatedUser = await this.userService.update(id, updateUserDto);
    return new User(updatedUser);
  }

  /**
   * Delete a user
   * Users can only delete their own profile
   * Admin can delete any profile
   */
  @Delete(':id')
  @UseGuards(SelfOrAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.userService.delete(id);
  }

  /**
   * Admin test endpoint
   * Only accessible by admins
   */
  @Get('admin/test')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin test endpoint for smoke testing' })
  @ApiResponse({ status: 200, description: 'Admin test successful' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  async adminTest(): Promise<{ message: string }> {
    return { message: 'Admin test successful' };
  }
}