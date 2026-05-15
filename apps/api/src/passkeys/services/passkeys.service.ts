import {
  BadRequestException,
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
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import {
  Passkey,
  NotificationType,
  Prisma,
  User,
  WebAuthnChallengeType,
} from '@prisma/client';
import { createHash } from 'crypto';
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
export const MAX_NICKNAME_LENGTH = 40;

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
        transports: c.transports as AuthenticatorTransportFuture[],
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
   * The capacity check + create are wrapped in a transaction so two
   * concurrent registration completions cannot both pass `assertCapacity`
   * and exceed `MAX_PASSKEYS_PER_USER`.
   */
  async verifyRegistration(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>,
    response: RegistrationResponseJSON,
    nickname: string,
  ): Promise<Passkey> {
    const trimmedNickname = this.normalizeRequiredNickname(nickname);
    this.assertRegistrationShape(response);
    const challengeRow = await this.consumeChallenge(
      this.extractChallenge(response.response.clientDataJSON),
      WebAuthnChallengeType.REGISTRATION,
      user.id,
    );
    const cfg = this.config();
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: cfg.origin,
        expectedRPID: cfg.rpId,
        requireUserVerification: true,
      });
    } catch (err) {
      this.logger.warn(`Passkey registration verify error: ${this.errorMessage(err)}`);
      throw new BadRequestException('Passkey registration failed verification');
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey registration failed verification');
    }
    const info = verification.registrationInfo;
    let created: Passkey;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const existingForUser = await tx.passkey.findMany({
          where: { userId: user.id },
          select: { webAuthnUserID: true },
        });
        if (existingForUser.length >= MAX_PASSKEYS_PER_USER) {
          throw new BadRequestException(
            `Cannot add more than ${MAX_PASSKEYS_PER_USER} passkeys per user`,
          );
        }
        // Match the webAuthnUserID we sent the browser during option generation,
        // not user.id. This ensures `userHandle === passkey.webAuthnUserID` checks
        // remain consistent if any future migration alters stored handles.
        const webAuthnUserID = existingForUser[0]?.webAuthnUserID ?? user.id;
        return tx.passkey.create({
          data: {
            userId: user.id,
            credentialId: info.credential.id,
            publicKey: Buffer.from(info.credential.publicKey),
            webAuthnUserID,
            counter: BigInt(info.credential.counter),
            transports: info.credential.transports ?? [],
            deviceType: info.credentialDeviceType,
            backedUp: info.credentialBackedUp,
            nickname: trimmedNickname,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Passkey already registered');
      }
      throw err;
    }
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
   *
   * Opportunistically purges expired challenge rows so abandoned login
   * ceremonies don't accumulate. The cleanup is fire-and-forget so a
   * cleanup error never blocks a legitimate login attempt.
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
    this.purgeExpiredChallenges();
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
      if (err instanceof UnauthorizedException) throw err;
      // Normalize any verifier/parsing/internal error to a generic
      // UnauthorizedException so we don't leak protocol details
      // (origin/RP ID/counter/library messages) to anonymous callers.
      this.logger.warn(`Passkey verify error normalized to 401: ${this.errorMessage(err)}`);
      throw new UnauthorizedException('Passkey verification failed');
    }
  }

  private async doVerifyAuthentication(
    response: AuthenticationResponseJSON,
  ): Promise<VerifiedPasskeyAuthentication> {
    this.assertAuthenticationShape(response);
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
      this.logger.warn(
        `Passkey verify: unknown credential (hash=${this.hashCredentialId(response.id)})`,
      );
      throw new UnauthorizedException('Passkey verification failed');
    }
    if (response.response.userHandle) {
      const decodedUserHandle = this.decodeUserHandle(response.response.userHandle);
      if (decodedUserHandle !== passkey.webAuthnUserID) {
        this.logger.warn(
          `Passkey verify: userHandle mismatch for credential hash ${this.hashCredentialId(response.id)}`,
        );
        throw new UnauthorizedException('Passkey verification failed');
      }
    }
    const cfg = this.config();
    // Pass counter: 0 to neutralize the library's built-in counter check so
    // we can apply our own policy that tolerates Apple/synced authenticators
    // returning 0 even after a nonzero stored counter.
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpId,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: 0,
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
    // Persist the counter monotonically. For nonzero new counters we use a
    // conditional updateMany so two concurrent verifications can't downgrade
    // the stored counter (e.g. A reads 5, sees 7, B reads 5, sees 6 — without
    // the WHERE guard the last writer wins and persists 6). For zero new
    // counter (Apple-style synced authenticators) we never touch the counter
    // column, so concurrency is harmless.
    if (newCounter > 0) {
      const updated = await this.prisma.passkey.updateMany({
        where: {
          id: passkey.id,
          counter: { lt: BigInt(newCounter) },
        },
        data: {
          counter: BigInt(newCounter),
          lastUsedAt: new Date(),
          backedUp: verification.authenticationInfo.credentialBackedUp,
          deviceType: verification.authenticationInfo.credentialDeviceType,
        },
      });
      if (updated.count === 0) {
        // Another concurrent verification advanced the counter past ours
        // (or beyond). Re-read and treat regression as a possible clone.
        const fresh = await this.prisma.passkey.findUnique({
          where: { id: passkey.id },
          select: { counter: true },
        });
        const freshCounter = fresh ? Number(fresh.counter) : 0;
        if (freshCounter >= newCounter) {
          this.logger.warn(
            `Passkey ${passkey.id} counter raced (stored=${freshCounter}, new=${newCounter}); accepting without overwrite.`,
          );
          await this.prisma.passkey.update({
            where: { id: passkey.id },
            data: {
              lastUsedAt: new Date(),
              backedUp: verification.authenticationInfo.credentialBackedUp,
              deviceType: verification.authenticationInfo.credentialDeviceType,
            },
          });
        } else {
          this.logger.error(
            `Passkey ${passkey.id} counter race resulted in regression (stored=${freshCounter}, new=${newCounter}). Possible cloned authenticator.`,
          );
          throw new UnauthorizedException('Passkey verification failed');
        }
      }
    } else {
      // newCounter === 0: leave the stored counter alone, just update metadata.
      await this.prisma.passkey.update({
        where: { id: passkey.id },
        data: {
          lastUsedAt: new Date(),
          backedUp: verification.authenticationInfo.credentialBackedUp,
          deviceType: verification.authenticationInfo.credentialDeviceType,
        },
      });
    }
    const { password: _password, ...userWithoutPassword } = passkey.user;
    void _password;
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
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    });
    if (!passkey) {
      throw new NotFoundException('Passkey not found');
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
    const trimmed = this.normalizeRequiredNickname(nickname);
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    });
    if (!passkey) {
      throw new NotFoundException('Passkey not found');
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

  private normalizeRequiredNickname(nickname: string | undefined | null): string {
    if (nickname === undefined || nickname === null) {
      throw new BadRequestException('Nickname is required');
    }
    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Nickname is required');
    }
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
    let row;
    try {
      // Atomic single-use: delete by unique field. If two requests race,
      // exactly one succeeds; the other gets P2025 and we surface a clean
      // BadRequestException instead of a 500.
      row = await this.prisma.webAuthnChallenge.delete({
        where: { challenge },
      });
    } catch (err) {
      // Only translate Prisma's "record not found" into a 400. Any other
      // error (DB connectivity loss, permission failure, etc.) should
      // surface as a 5xx so production incidents are diagnosable rather
      // than masquerading as a client error.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new BadRequestException('Unknown or already-used challenge');
      }
      throw err;
    }
    // Best-effort lazy cleanup — fire and forget.
    this.purgeExpiredChallenges();
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
    let parsed: { challenge?: string };
    try {
      const json = Buffer.from(clientDataJSONBase64Url, 'base64url').toString('utf8');
      parsed = JSON.parse(json) as { challenge?: string };
    } catch {
      throw new BadRequestException('Malformed clientDataJSON');
    }
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

  /**
   * Validates the minimum WebAuthn assertion shape before any verifier work.
   * Throws UnauthorizedException so the public verify path doesn't leak
   * structural details for malformed inputs.
   */
  private assertAuthenticationShape(response: AuthenticationResponseJSON): void {
    if (!response || typeof response !== 'object') {
      throw new UnauthorizedException('Passkey verification failed');
    }
    const r = response.response as unknown as Record<string, unknown> | undefined;
    if (
      typeof response.id !== 'string' ||
      typeof response.rawId !== 'string' ||
      typeof response.type !== 'string' ||
      !r ||
      typeof r.clientDataJSON !== 'string' ||
      typeof r.authenticatorData !== 'string' ||
      typeof r.signature !== 'string'
    ) {
      throw new UnauthorizedException('Passkey verification failed');
    }
  }

  /**
   * Validates the minimum registration response shape before verifier work.
   */
  private assertRegistrationShape(response: RegistrationResponseJSON): void {
    if (!response || typeof response !== 'object') {
      throw new BadRequestException('Malformed registration response');
    }
    const r = response.response as unknown as Record<string, unknown> | undefined;
    if (
      typeof response.id !== 'string' ||
      typeof response.rawId !== 'string' ||
      typeof response.type !== 'string' ||
      !r ||
      typeof r.clientDataJSON !== 'string' ||
      typeof r.attestationObject !== 'string'
    ) {
      throw new BadRequestException('Malformed registration response');
    }
  }

  /**
   * The browser sends `userHandle` as base64url-encoded bytes of whatever
   * we passed as `userID` to generateRegistrationOptions (UTF-8 of user.id).
   * Decode back to UTF-8 so we can compare to the stored webAuthnUserID.
   */
  private decodeUserHandle(userHandleBase64Url: string): string {
    return Buffer.from(userHandleBase64Url, 'base64url').toString('utf8');
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

  /**
   * Truncated SHA-256 of a credential ID for use in log messages. Avoids
   * spilling full credential identifiers into application logs while keeping
   * enough entropy for forensic correlation across requests.
   */
  private hashCredentialId(credentialId: string): string {
    return createHash('sha256').update(credentialId).digest('hex').slice(0, 12);
  }

  /**
   * Fire-and-forget cleanup of expired challenge rows. Errors are swallowed
   * so cleanup can never block a legitimate ceremony.
   */
  private purgeExpiredChallenges(): void {
    this.prisma.webAuthnChallenge
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {
        /* ignore */
      });
  }
}
