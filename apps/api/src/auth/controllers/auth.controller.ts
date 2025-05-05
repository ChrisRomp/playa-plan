import { Controller, Post, Body, UseGuards, Get, Request, Query, HttpStatus, HttpCode, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { Public } from '../decorators/public.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { User } from '@prisma/client';
import { RequestLoginCodeDto } from '../dto/request-login-code.dto';
import { EmailCodeLoginDto } from '../dto/email-code-login.dto';

// Define the user type for request objects
interface RequestWithUser extends ExpressRequest {
  user: Omit<User, 'password'>;
}

/**
 * Controller for authentication-related endpoints
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * @param registerDto Registration data
   * @returns Authentication response with token
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
    type: AuthResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'User with this email already exists'
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data'
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.authService.register(registerDto);
    return this.authService.login(user);
  }

  /**
   * Login with email and password
   * @param req Request object with authenticated user
   * @returns Authentication response with token
   */
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: HttpStatus.OK,
    description: 'User successfully logged in',
    type: AuthResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid credentials'
  })
  async login(@Request() req: RequestWithUser): Promise<AuthResponseDto> {
    return this.authService.login(req.user);
  }
  
  /**
   * Request a login code for email verification-based login
   * @param requestLoginCodeDto Email address
   * @returns Success message
   */
  @Public()
  @Post('request-login-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a login code for email verification-based login' })
  @ApiBody({ type: RequestLoginCodeDto })
  @ApiResponse({ 
    status: HttpStatus.OK,
    description: 'Login code sent if email exists'
  })
  async requestLoginCode(@Body() requestLoginCodeDto: RequestLoginCodeDto): Promise<{ message: string }> {
    const { email } = requestLoginCodeDto;
    
    const result = await this.authService.generateLoginCode(email);
    
    if (!result) {
      throw new BadRequestException('Failed to send login code');
    }
    
    // Always return success to prevent user enumeration
    return { message: 'If your email exists in our system, you will receive a login code' };
  }
  
  /**
   * Login with email verification code
   * @param emailCodeLoginDto Email and verification code
   * @returns Authentication response with token
   */
  @Public()
  @Post('login-with-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email verification code' })
  @ApiBody({ type: EmailCodeLoginDto })
  @ApiResponse({ 
    status: HttpStatus.OK,
    description: 'User successfully logged in',
    type: AuthResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Invalid or expired verification code'
  })
  async loginWithCode(@Body() emailCodeLoginDto: EmailCodeLoginDto): Promise<AuthResponseDto> {
    const { email, code } = emailCodeLoginDto;
    
    const user = await this.authService.validateLoginCode(email, code);
    
    if (!user) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    
    return this.authService.login(user);
  }

  /**
   * Verify user email with token
   * @param token Verification token
   * @returns Success message
   */
  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify user email with token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email verified successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid verification token' })
  async verifyEmail(@Query('token') token: string): Promise<{ message: string }> {
    const isVerified = await this.authService.verifyEmail(token);
    
    if (!isVerified) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    return { message: 'Email verified successfully' };
  }

  /**
   * Get current user profile (protected route)
   * @param req Request object with authenticated user
   * @returns User profile data
   */
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async getProfile(@Request() req: RequestWithUser): Promise<Omit<User, 'password'>> {
    // User is already injected in request by JWT strategy
    return req.user;
  }

  /**
   * Test endpoint for checking authentication
   * @returns Test message
   */
  @Get('test')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test authentication' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Authentication is working' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  testAuth(): { message: string } {
    return { message: 'Authentication is working' };
  }
}