import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { User } from '@prisma/client';
import { PasskeysService } from '../services/passkeys.service';
import { PasskeyResponseDto } from '../dto/passkey-response.dto';
import { UpdatePasskeyDto } from '../dto/update-passkey.dto';
import { VerifyRegistrationDto } from '../dto/verify-passkey.dto';

interface RequestWithUser extends ExpressRequest {
  user: Omit<User, 'password'>;
}

/**
 * REST endpoints for an authenticated user to enroll, list, rename, and
 * remove their own passkeys. Public passkey login endpoints live on
 * AuthController instead so they can sit alongside the other login flows.
 */
@ApiTags('Passkeys')
@ApiBearerAuth()
@Controller('passkeys')
export class PasskeyController {
  constructor(private readonly passkeysService: PasskeysService) {}

  /**
   * Enrollment is gated on a verified email address. Without this gate, the
   * legacy `/auth/register` flow (which issues a JWT before the email is
   * verified) would let anyone bind a passkey to an unverified account
   * tied to someone else's email — a pre-hijacking risk if the real email
   * owner later logs in via email code.
   */
  private assertVerified(user: Pick<User, 'isEmailVerified'>): void {
    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Verify your email before adding a passkey',
      );
    }
  }

  @Post('registration/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate WebAuthn registration options for the current user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Registration options issued' })
  async registrationOptions(@Request() req: RequestWithUser) {
    this.assertVerified(req.user);
    return this.passkeysService.createRegistrationOptions(req.user);
  }

  @Post('registration/verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Verify the browser registration response and persist a passkey' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Passkey registered' })
  async verifyRegistration(
    @Request() req: RequestWithUser,
    @Body() body: VerifyRegistrationDto,
  ): Promise<PasskeyResponseDto> {
    this.assertVerified(req.user);
    const passkey = await this.passkeysService.verifyRegistration(
      req.user,
      body.response,
      body.nickname,
    );
    return PasskeyResponseDto.fromEntity(passkey);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's passkeys" })
  @ApiResponse({ status: HttpStatus.OK, type: [PasskeyResponseDto] })
  async list(@Request() req: RequestWithUser): Promise<PasskeyResponseDto[]> {
    const passkeys = await this.passkeysService.listForUser(req.user.id);
    return passkeys.map((p) => PasskeyResponseDto.fromEntity(p));
  }

  @Patch(':id')
  @ApiOperation({ summary: "Rename one of the current user's passkeys" })
  @ApiResponse({ status: HttpStatus.OK, type: PasskeyResponseDto })
  async update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePasskeyDto,
  ): Promise<PasskeyResponseDto> {
    const updated = await this.passkeysService.updateNickname(req.user.id, id, body.nickname);
    return PasskeyResponseDto.fromEntity(updated);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete one of the current user's passkeys" })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Passkey deleted' })
  async remove(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.passkeysService.deleteForUser(req.user.id, id, req.user);
  }
}
