import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  Passkey,
  NotificationType,
  User,
  WebAuthnChallengeType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { WebAuthnConfig } from '../../config/webauthn-config.validator';

/**
 * Maximum number of passkeys a single user may register. Matches GitHub's
 * cap; raisable if needed without schema changes.
 */
export const MAX_PASSKEYS_PER_USER = 5;

/**
 * Maximum length of a user-supplied passkey nickname (plaintext).
 */
export const MAX_NICKNAME_LENGTH = 20;

/**
 * How long an issued challenge remains valid. Five minutes is plenty for
 * a user to complete a ceremony and short enough to limit replay risk.
 */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Minimum time, in ms, that the verify path should take when no matching
 * credential exists. Pads response time so an attacker cannot enumerate
 * registered credentials by measuring server response time.
 */
const TIMING_PAD_MS = 250;

/**
 * Result of authentication-response verification. Returns the user record
 * for the matched credential so the caller (AuthController) can issue a JWT.
 */
export interface VerifiedPasskeyAuthentication {
  user: Omit<User, 'password'>;
  passkeyId: string;
}

@Injectable()
export class PasskeysService {
  private readonly logger = new Logger(PasskeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Builds registration options for an authenticated user adding a new
   * passkey. Stores the issued challenge for later verification.
   * Throws if the user already has the maximum number of passkeys.
   */
  async createRegistrationOptions(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>,
  ) {
    await this.assertCapacity(user.id);
    const cfg = this.config();
    const existing = await this.prisma.passkey.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true, webAuthnUserID: true },
    });
    const webAuthnUserID = existing[0]?.webAuthnUserID ?? user.id;
    const userIdBytes = new TextEncoder().encode(webAuthnUserID);
    const options = await generateRegistrationOptions({
      rpName: cfg.rpName,
      rpID: cfg.rpId,
      userName: user.email,
      userID: userIdBytes,
      userDisplayName: this.displayName(user),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as never,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
    });
    await this.prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        userId: user.id,
        type: WebAuthnChallengeType.REGISTRATION,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return options;
  }

  /**
   * Verifies the browser-returned attestation, persists the new passkey,
   * deletes the consumed challenge, and dispatches a notification email.
   */
  async verifyRegistration(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>,
    response: RegistrationResponseJSON,
    nickname?: string,
  ): Promise<Passkey> {
    await this.assertCapacity(user.id);
    const trimmedNickname = this.normalizeNickname(nickname);
    const challengeRow = await this.consumeChallenge(
      response.response.clientDataJSON
        ? this.extractChallenge(response.response.clientDataJSON)
        : null,
      WebAuthnChallengeType.REGISTRATION,
      user.id,
    );
    const cfg = this.config();
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpId,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey registration failed verification');
    }
    const info = verification.registrationInfo;
    const created = await this.prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: info.credential.id,
        publicKey: Buffer.from(info.credential.publicKey),
        webAuthnUserID: user.id,
        counter: BigInt(info.credential.counter),
        transports: info.credential.transports ?? [],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        nickname: trimmedNickname,
      },
    });
    this.dispatchNotification(user, 'PASSKEY_ADDED', created).catch((err) =>
      this.logger.error(
        `Failed to send PASSKEY_ADDED notification for user ${user.id}: ${this.errorMessage(err)}`,
      ),
    );
    return created;
  }

  // ---------------------------------------------------------------------------
  // Authentication (usernameless / discoverable)
  // ---------------------------------------------------------------------------

  /**
   * Builds authentication options for a usernameless ("Sign in with a passkey")
   * flow. allowCredentials is empty so the browser can present any
   * discoverable credential the user has for this RP.
   */
  async createAuthenticationOptions() {
    const cfg = this.config();
    const options = await generateAuthenticationOptions({
      rpID: cfg.rpId,
      userVerification: 'required',
      allowCredentials: [],
    });
    await this.prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        userId: null,
        type: WebAuthnChallengeType.AUTHENTICATION,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return options;
  }

  /**
   * Verifies an authentication assertion, updates the credential's counter,
   * and returns the matched user. Includes timing padding so callers cannot
   * use response time to enumerate registered credentials.
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
  ): Promise<VerifiedPasskeyAuthentication> {
    const startedAt = Date.now();
    try {
      return await this.doVerifyAuthentication(response);
    } catch (err) {
      await this.padTiming(startedAt);
      throw err;
    }
  }

  private async doVerifyAuthentication(
    response: AuthenticationResponseJSON,
  ): Promise<VerifiedPasskeyAuthentication> {
    const challengeStr = this.extractChallenge(response.response.clientDataJSON);
    const challengeRow = await this.consumeChallenge(
      challengeStr,
      WebAuthnChallengeType.AUTHENTICATION,
      null,
    );
    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: response.id },
      include: { user: true },
    });
    if (!passkey) {
      this.logger.warn(`Passkey verify: unknown credentialId ${response.id}`);
      throw new UnauthorizedException('Passkey verification failed');
    }
    if (response.response.userHandle && response.response.userHandle !== passkey.webAuthnUserID) {
      this.logger.warn(
        `Passkey verify: userHandle mismatch for credential ${response.id}`,
      );
      throw new UnauthorizedException('Passkey verification failed');
    }
    const cfg = this.config();
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpId,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as never,
      },
    });
    if (!verification.verified) {
      throw new UnauthorizedException('Passkey verification failed');
    }
    const newCounter = verification.authenticationInfo.newCounter;
    const storedCounter = Number(passkey.counter);
    if (storedCounter > 0 && newCounter > 0 && newCounter <= storedCounter) {
      this.logger.error(
        `Counter regression detected for passkey ${passkey.id} (stored=${storedCounter}, new=${newCounter}). Possible cloned authenticator.`,
      );
      throw new UnauthorizedException('Passkey verification failed');
    }
    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(newCounter),
        lastUsedAt: new Date(),
        backedUp: verification.authenticationInfo.credentialBackedUp,
        deviceType: verification.authenticationInfo.credentialDeviceType,
      },
    });
    const { password: _password, ...userWithoutPassword } = passkey.user;
    return { user: userWithoutPassword, passkeyId: passkey.id };
  }

  // ---------------------------------------------------------------------------
  // Management
  // ---------------------------------------------------------------------------

  async listForUser(userId: string): Promise<Passkey[]> {
    return this.prisma.passkey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteForUser(
    userId: string,
    passkeyId: string,
    actor: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>,
  ): Promise<void> {
    const passkey = await this.prisma.passkey.findUnique({
      where: { id: passkeyId },
    });
    if (!passkey) {
      throw new NotFoundException('Passkey not found');
    }
    if (passkey.userId !== userId) {
      throw new ForbiddenException('Cannot delete another user\'s passkey');
    }
    await this.prisma.passkey.delete({ where: { id: passkeyId } });
    this.dispatchNotification(actor, 'PASSKEY_REMOVED', passkey).catch((err) =>
      this.logger.error(
        `Failed to send PASSKEY_REMOVED notification for user ${userId}: ${this.errorMessage(err)}`,
      ),
    );
  }

  async updateNickname(
    userId: string,
    passkeyId: string,
    nickname: string,
  ): Promise<Passkey> {
    const trimmed = this.normalizeNickname(nickname);
    const passkey = await this.prisma.passkey.findUnique({
      where: { id: passkeyId },
    });
    if (!passkey) {
      throw new NotFoundException('Passkey not found');
    }
    if (passkey.userId !== userId) {
      throw new ForbiddenException('Cannot modify another user\'s passkey');
    }
    return this.prisma.passkey.update({
      where: { id: passkeyId },
      data: { nickname: trimmed },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private config(): WebAuthnConfig {
    const cfg = this.configService.get<WebAuthnConfig>('webauthn');
    if (!cfg) {
      throw new Error('WebAuthn config is not initialized');
    }
    return cfg;
  }

  private async assertCapacity(userId: string): Promise<void> {
    const count = await this.prisma.passkey.count({ where: { userId } });
    if (count >= MAX_PASSKEYS_PER_USER) {
      throw new BadRequestException(
        `Cannot add more than ${MAX_PASSKEYS_PER_USER} passkeys per user`,
      );
    }
  }

  private normalizeNickname(nickname: string | undefined | null): string | null {
    if (nickname === undefined || nickname === null) return null;
    const trimmed = nickname.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > MAX_NICKNAME_LENGTH) {
      throw new BadRequestException(
        `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer`,
      );
    }
    return trimmed;
  }

  private displayName(
    user: Pick<User, 'firstName' | 'lastName' | 'email'>,
  ): string {
    const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return full.length > 0 ? full : user.email;
  }

  /**
   * Atomically deletes the matching challenge and returns it. Throws if the
   * challenge does not exist, has expired, has the wrong type, or belongs to
   * the wrong user. The delete-on-read pattern prevents replay even if the
   * verify result is later rejected. Also opportunistically purges other
   * expired challenge rows (lazy cleanup; no scheduler required).
   */
  private async consumeChallenge(
    challenge: string | null,
    type: WebAuthnChallengeType,
    expectedUserId: string | null,
  ) {
    if (!challenge) {
      throw new BadRequestException('Missing challenge in client data');
    }
    const row = await this.prisma.webAuthnChallenge.findUnique({
      where: { challenge },
    });
    if (!row) {
      throw new BadRequestException('Unknown or already-used challenge');
    }
    await this.prisma.webAuthnChallenge.delete({ where: { id: row.id } });
    this.prisma.webAuthnChallenge
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {
        // Best-effort cleanup; ignore errors.
      });
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Challenge has expired');
    }
    if (row.type !== type) {
      throw new BadRequestException('Challenge type mismatch');
    }
    if (expectedUserId !== null && row.userId !== expectedUserId) {
      throw new BadRequestException('Challenge does not belong to user');
    }
    return row;
  }

  /**
   * Extracts the base64url challenge embedded in clientDataJSON. The browser
   * sends clientDataJSON as a base64url-encoded JSON blob; we decode it to
   * locate the original challenge so the right WebAuthnChallenge row can
   * be looked up.
   */
  private extractChallenge(clientDataJSONBase64Url: string): string {
    const json = Buffer.from(clientDataJSONBase64Url, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as { challenge?: string };
    if (!parsed.challenge || typeof parsed.challenge !== 'string') {
      throw new BadRequestException('clientDataJSON missing challenge');
    }
    return parsed.challenge;
  }

  private async padTiming(startedAt: number): Promise<void> {
    const elapsed = Date.now() - startedAt;
    const remaining = TIMING_PAD_MS - elapsed;
    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
  }

  private async dispatchNotification(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>,
    kind: 'PASSKEY_ADDED' | 'PASSKEY_REMOVED',
    passkey: Pick<Passkey, 'nickname' | 'createdAt'>,
  ): Promise<void> {
    const type =
      kind === 'PASSKEY_ADDED' ? NotificationType.PASSKEY_ADDED : NotificationType.PASSKEY_REMOVED;
    await this.notificationsService.sendNotification(user.email, type, {
      userId: user.id,
      passkeyDetails: {
        nickname: passkey.nickname,
        timestamp: new Date(),
        firstName: user.firstName,
      },
    });
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
