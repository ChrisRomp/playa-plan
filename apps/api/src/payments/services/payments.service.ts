import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  CreateRefundDto,
  CreateExternalPaymentDto,
  CreateStripePaymentDto,
  CreatePaypalPaymentDto,
} from '../dto';
import {
  AdminAuditActionType,
  AdminAuditTargetType,
  ExternalPaymentMethod,
  Payment,
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  Prisma,
  RefundExecutionMode,
  Registration,
  RegistrationStatus,
  UserRole,
} from '@prisma/client';
import { StripeService } from './stripe.service';
import { PaypalService } from './paypal.service';
import { isApplicationStatus } from '../../registrations/constants/registration-status.constants';
import { centsToDollars, dollarsToCents, normalizeCurrency } from '../utils/money.utils';
import { randomUUID } from 'crypto';

// Create an extended Payment type that includes registration relationship
type PaymentWithRelations = Payment & {
  registration?: Registration | null;
};

// Interface for PayPal link object
interface PayPalLink {
  rel: string;
  href: string;
}

// Interface for Prisma where clause
interface PaymentWhereClause {
  userId?: string;
  status?: PaymentStatus;
}

const sharedPaymentSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  providerRefId: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  registrationId: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  registration: true,
} satisfies Prisma.PaymentSelect;

const adminRefundSelect = {
  id: true,
  amountCents: true,
  currency: true,
  executionMode: true,
  status: true,
  reason: true,
  externalReference: true,
  resultingRegistrationStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentRefundSelect;

const internalRefundSelect = {
  ...adminRefundSelect,
  paymentId: true,
  idempotencyKey: true,
} satisfies Prisma.PaymentRefundSelect;

const adminPaymentSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  externalMethod: true,
  externalReference: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  registrationId: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  registration: {
    select: {
      id: true,
      year: true,
      status: true,
    },
  },
  refunds: {
    select: adminRefundSelect,
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.PaymentSelect;

const externalPaymentSelect = {
  ...adminPaymentSelect,
  idempotencyKey: true,
} satisfies Prisma.PaymentSelect;

type SharedPayment = Omit<Payment, 'externalMethod' | 'externalReference' | 'idempotencyKey'>;

type SharedPaymentWithRelations = SharedPayment & {
  registration?: Registration | null;
};

type AdminPaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof adminPaymentSelect;
}>;

type ExternalPaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof externalPaymentSelect;
}>;

export type AdminRefund = Prisma.PaymentRefundGetPayload<{
  select: typeof adminRefundSelect;
}>;

type InternalRefundRecord = Prisma.PaymentRefundGetPayload<{
  select: typeof internalRefundSelect;
}>;

interface RefundTotals {
  paymentAmountCents: number | null;
  successfulRefundCents: number;
  pendingRefundCents: number;
  availableRefundCents: number;
  refundUnavailableReason: string | null;
}

export type AdminPayment = AdminPaymentRecord & RefundTotals;

export interface ManualRefundResult extends RefundTotals {
  payment: AdminPayment;
  refund: AdminRefund;
}

interface CanonicalExternalPayment {
  registrationId: string;
  amountCents: number;
  currency: string;
  externalMethod: ExternalPaymentMethod;
  externalReference: string | null;
}

interface CanonicalManualRefund {
  amountCents?: number;
  fullRefund: boolean;
  executionMode: RefundExecutionMode;
  reason: string | null;
  externalReference: string | null;
  resultingRegistrationStatus: RegistrationStatus | null;
}

interface LegacyRefundRequest {
  paymentId: string;
  amount?: number;
  percentageOfOriginal?: number;
  reason?: string;
}

const DEFAULT_ADMIN_PAYMENT_PAGE_SIZE = 25;
const MAX_ADMIN_PAYMENT_PAGE_SIZE = 100;
const UNSUPPORTED_PAYMENT_PRECISION_REASON =
  'Refund unavailable because the stored payment amount has unsupported precision.';
const UNSUPPORTED_PAYMENT_CURRENCY_REASON =
  'Refund unavailable because the stored payment currency is invalid.';
const REFUND_REASON_MAX_LENGTH = 500;
const REFUND_EXTERNAL_REFERENCE_MAX_LENGTH = 255;

// Interface for refund result
export interface RefundResult {
  paymentId: string;
  refundAmount: number;
  providerRefundId: string;
  success: boolean;
}

// Interface for provider refund response
interface ProviderRefund {
  id: string;
}

/**
 * Service for managing payments
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paypalService: PaypalService,
    private readonly notificationsService: NotificationsService
  ) {}

  /**
   * Create a new payment record
   * @param createPaymentDto - Payment data
   * @returns The created payment
   */
  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    this.logger.log(`Creating payment record for user ${createPaymentDto.userId}`);

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createPaymentDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${createPaymentDto.userId} not found`);
    }

    // If registration ID provided, verify it exists and belongs to the user
    if (createPaymentDto.registrationId) {
      const registration = await this.prisma.registration.findUnique({
        where: { id: createPaymentDto.registrationId },
      });

      if (!registration) {
        throw new NotFoundException(
          `Registration with ID ${createPaymentDto.registrationId} not found`
        );
      }

      if (registration.userId !== createPaymentDto.userId) {
        throw new BadRequestException('Registration does not belong to the specified user');
      }

      // Prevent payments for registrations still in application phase
      if (isApplicationStatus(registration.status)) {
        throw new BadRequestException(
          'Cannot process payment for a registration that has not completed the application process'
        );
      }
    }

    try {
      const paymentData = {
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency || 'USD',
        status: PaymentStatus.PENDING,
        provider: createPaymentDto.provider,
        providerRefId: createPaymentDto.providerRefId,
        user: { connect: { id: createPaymentDto.userId } },
        ...(createPaymentDto.registrationId && {
          registration: { connect: { id: createPaymentDto.registrationId } },
        }),
      };

      return await this.prisma.payment.create({
        data: paymentData,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to create payment record: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Find all payments, with filtering options
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to take (pagination)
   * @param userId - Filter by user ID
   * @param status - Filter by payment status
   * @returns Paginated list of payments
   */
  async findAll(
    skip = 0,
    take = 10,
    userId?: string,
    status?: PaymentStatus
  ): Promise<{ payments: SharedPayment[]; total: number }> {
    const where: PaymentWhereClause = {};

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        select: sharedPaymentSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, total };
  }

  /**
   * Returns a bounded payment list containing only fields needed by admins.
   */
  async findAllForAdmin(
    skip = 0,
    take = DEFAULT_ADMIN_PAYMENT_PAGE_SIZE
  ): Promise<{ payments: AdminPayment[]; total: number }> {
    if (!Number.isInteger(skip) || skip < 0) {
      throw new BadRequestException('Skip must be a non-negative integer');
    }

    if (!Number.isInteger(take) || take < 1 || take > MAX_ADMIN_PAYMENT_PAGE_SIZE) {
      throw new BadRequestException(
        `Take must be an integer between 1 and ${MAX_ADMIN_PAYMENT_PAGE_SIZE}`
      );
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take,
        select: adminPaymentSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count(),
    ]);

    return {
      payments: payments.map(payment => this.toAdminPayment(payment)),
      total,
    };
  }

  /**
   * Find one payment by ID
   * @param id - Payment ID
   * @returns The payment, if found
   */
  async findOne(id: string): Promise<PaymentWithRelations> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        registration: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  /**
   * Find one payment by ID with ownership check
   * @param id - Payment ID
   * @param userId - Current user ID
   * @param userRole - Current user role
   * @returns The payment, if found and user has access
   */
  async findOneWithOwnershipCheck(
    id: string,
    userId: string,
    userRole: UserRole
  ): Promise<SharedPaymentWithRelations> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: sharedPaymentSelect,
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // Check ownership - only admins/staff can view any payment, others can only view their own
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.STAFF && payment.userId !== userId) {
      throw new NotFoundException(`Payment with ID ${id} not found`); // Don't reveal that payment exists
    }

    return payment;
  }

  /**
   * Update a payment
   * @param id - Payment ID
   * @param updatePaymentDto - Data to update
   * @returns The updated payment
   */
  async update(id: string, updatePaymentDto: UpdatePaymentDto): Promise<Payment> {
    // Check if payment exists
    await this.findOne(id);

    try {
      return await this.prisma.payment.update({
        where: { id },
        data: updatePaymentDto,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to update payment ${id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Link a payment to a registration
   * @param paymentId - Payment ID
   * @param registrationId - Registration ID
   * @returns The updated payment
   */
  async linkToRegistration(paymentId: string, registrationId: string): Promise<Payment> {
    // Check if payment exists
    const payment = await this.findOne(paymentId);

    // Check if registration exists
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { payments: true },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${registrationId} not found`);
    }

    // Prevent linking payments to registrations in application phase
    if (isApplicationStatus(registration.status)) {
      throw new BadRequestException(
        'Cannot link payment to a registration that has not completed the application process'
      );
    }

    // Check if registration belongs to the same user as the payment
    if (registration.userId !== payment.userId) {
      throw new BadRequestException('Registration does not belong to the same user as the payment');
    }

    // Check if payment is already linked to this registration
    if (payment.registrationId === registrationId) {
      throw new BadRequestException(`Payment is already linked to registration ${registrationId}`);
    }

    try {
      // Update payment to link it to the registration
      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: { registrationId },
      });

      return updatedPayment;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to link payment to registration: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Process a Payment DTO reference field safely, ensuring proper string | undefined type
   * @param reference - Reference string that might be null
   * @returns A string or undefined, never null
   */
  private processReference(reference: string | null | undefined): string | undefined {
    if (reference === null) {
      return undefined;
    }
    return reference;
  }

  /**
   * Records an already-completed external payment and its registration effects.
   */
  async recordExternalPayment(
    data: CreateExternalPaymentDto,
    adminUserId: string
  ): Promise<AdminPayment> {
    const canonicalRequest = this.canonicalizeExternalPayment(data);
    const transactionId = randomUUID();

    try {
      return await this.prisma.$transaction(async tx => {
        const existingPayment = await tx.payment.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          select: externalPaymentSelect,
        });

        if (existingPayment) {
          return this.resolveExternalPaymentReplay(existingPayment, canonicalRequest);
        }

        const registration = await tx.registration.findUnique({
          where: { id: data.registrationId },
          select: {
            id: true,
            userId: true,
            status: true,
          },
        });

        if (!registration) {
          throw new NotFoundException(`Registration with ID ${data.registrationId} not found`);
        }

        this.validateExternalPaymentRegistration(registration.status);
        const resultingStatus =
          registration.status === RegistrationStatus.PENDING
            ? RegistrationStatus.CONFIRMED
            : registration.status;

        const registrationUpdate = await tx.registration.updateMany({
          where: {
            id: registration.id,
            status: registration.status,
          },
          data: {
            status: resultingStatus,
            paymentDeferred: false,
          },
        });

        if (registrationUpdate.count !== 1) {
          const concurrentPayment = await tx.payment.findUnique({
            where: { idempotencyKey: data.idempotencyKey },
            select: externalPaymentSelect,
          });

          if (concurrentPayment) {
            return this.resolveExternalPaymentReplay(concurrentPayment, canonicalRequest);
          }

          throw new ConflictException(
            'Registration changed while recording payment; refresh and retry'
          );
        }

        const createdPayment = await tx.payment.create({
          data: {
            amount: data.amount,
            currency: canonicalRequest.currency,
            status: PaymentStatus.COMPLETED,
            provider: PaymentProvider.MANUAL,
            externalMethod: data.externalMethod,
            externalReference: canonicalRequest.externalReference,
            idempotencyKey: data.idempotencyKey,
            userId: registration.userId,
            registrationId: registration.id,
          },
          select: externalPaymentSelect,
        });

        await tx.adminAudit.create({
          data: {
            adminUserId,
            actionType: AdminAuditActionType.PAYMENT_EXTERNAL,
            targetRecordType: AdminAuditTargetType.PAYMENT,
            targetRecordId: createdPayment.id,
            transactionId,
            newValues: {
              outcome: 'COMPLETED',
              paymentId: createdPayment.id,
              registrationId: registration.id,
              amount: data.amount,
              currency: canonicalRequest.currency,
              externalMethod: data.externalMethod,
              externalReference: canonicalRequest.externalReference,
              previousRegistrationStatus: registration.status,
              resultingRegistrationStatus: resultingStatus,
            },
            reason: 'Recorded completed external payment',
          },
        });

        return this.toAdminPayment(createdPayment);
      });
    } catch (error: unknown) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existingPayment = await this.prisma.payment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        select: externalPaymentSelect,
      });

      if (!existingPayment) {
        throw error;
      }

      return this.resolveExternalPaymentReplay(existingPayment, canonicalRequest);
    }
  }

  private canonicalizeExternalPayment(data: CreateExternalPaymentDto): CanonicalExternalPayment {
    try {
      return {
        registrationId: data.registrationId,
        amountCents: dollarsToCents(data.amount),
        currency: normalizeCurrency(data.currency),
        externalMethod: data.externalMethod,
        externalReference: data.externalReference?.trim() || null,
      };
    } catch (error: unknown) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private resolveExternalPaymentReplay(
    existingPayment: ExternalPaymentRecord,
    canonicalRequest: CanonicalExternalPayment
  ): AdminPayment {
    const existingCanonicalRequest: CanonicalExternalPayment = {
      registrationId: existingPayment.registrationId ?? '',
      amountCents: dollarsToCents(existingPayment.amount),
      currency: normalizeCurrency(existingPayment.currency),
      externalMethod: existingPayment.externalMethod as ExternalPaymentMethod,
      externalReference: existingPayment.externalReference?.trim() || null,
    };

    if (
      existingCanonicalRequest.registrationId !== canonicalRequest.registrationId ||
      existingCanonicalRequest.amountCents !== canonicalRequest.amountCents ||
      existingCanonicalRequest.currency !== canonicalRequest.currency ||
      existingCanonicalRequest.externalMethod !== canonicalRequest.externalMethod ||
      existingCanonicalRequest.externalReference !== canonicalRequest.externalReference
    ) {
      throw new ConflictException(
        'Idempotency key has already been used with different payment data'
      );
    }

    return this.toAdminPayment(existingPayment);
  }

  private toAdminPayment(payment: AdminPaymentRecord | ExternalPaymentRecord): AdminPayment {
    const totals = this.getAdminRefundTotals(payment);

    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      externalMethod: payment.externalMethod,
      externalReference: payment.externalReference,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      userId: payment.userId,
      registrationId: payment.registrationId,
      user: payment.user,
      registration: payment.registration,
      refunds: payment.refunds,
      ...totals,
    };
  }

  private getAdminRefundTotals(
    payment: AdminPaymentRecord | ExternalPaymentRecord
  ): RefundTotals {
    let paymentAmountCents: number;
    try {
      paymentAmountCents = dollarsToCents(payment.amount);
    } catch (error: unknown) {
      if (!(error instanceof RangeError)) {
        throw error;
      }

      return this.buildUnavailableRefundTotals(
        null,
        payment.refunds,
        UNSUPPORTED_PAYMENT_PRECISION_REASON,
        false
      );
    }

    const isLegacyLedgerlessRefund =
      payment.status === PaymentStatus.REFUNDED && payment.refunds.length === 0;

    try {
      this.validateStoredPaymentCurrency(payment.currency);
    } catch (error: unknown) {
      if (!(error instanceof RangeError)) {
        throw error;
      }

      return this.buildUnavailableRefundTotals(
        paymentAmountCents,
        payment.refunds,
        UNSUPPORTED_PAYMENT_CURRENCY_REASON,
        isLegacyLedgerlessRefund
      );
    }

    return this.calculateRefundTotals(paymentAmountCents, payment.refunds, isLegacyLedgerlessRefund);
  }

  private buildUnavailableRefundTotals(
    paymentAmountCents: number | null,
    refunds: ReadonlyArray<{
      amountCents: number;
      status: PaymentRefundStatus;
    }>,
    refundUnavailableReason: string,
    forceFullyRefunded: boolean
  ): RefundTotals {
    const ledgerTotals =
      forceFullyRefunded && paymentAmountCents !== null
        ? {
            successfulRefundCents: paymentAmountCents,
            pendingRefundCents: 0,
          }
        : this.calculateRefundLedgerTotals(refunds);

    return {
      paymentAmountCents,
      ...ledgerTotals,
      availableRefundCents: 0,
      refundUnavailableReason,
    };
  }

  private calculateRefundTotals(
    paymentAmountCents: number,
    refunds: ReadonlyArray<{
      amountCents: number;
      status: PaymentRefundStatus;
    }>,
    forceFullyRefunded = false
  ): RefundTotals {
    if (forceFullyRefunded) {
      return {
        paymentAmountCents,
        successfulRefundCents: paymentAmountCents,
        pendingRefundCents: 0,
        availableRefundCents: 0,
        refundUnavailableReason: null,
      };
    }

    const ledgerTotals = this.calculateRefundLedgerTotals(refunds);

    return {
      paymentAmountCents,
      ...ledgerTotals,
      availableRefundCents:
        paymentAmountCents -
        ledgerTotals.successfulRefundCents -
        ledgerTotals.pendingRefundCents,
      refundUnavailableReason: null,
    };
  }

  private calculateRefundLedgerTotals(
    refunds: ReadonlyArray<{
      amountCents: number;
      status: PaymentRefundStatus;
    }>
  ): Pick<RefundTotals, 'successfulRefundCents' | 'pendingRefundCents'> {
    const successfulRefundCents = refunds
      .filter(refund => refund.status === PaymentRefundStatus.SUCCEEDED)
      .reduce((total, refund) => total + refund.amountCents, 0);
    const pendingRefundCents = refunds
      .filter(refund => refund.status === PaymentRefundStatus.PENDING)
      .reduce((total, refund) => total + refund.amountCents, 0);

    return {
      successfulRefundCents,
      pendingRefundCents,
    };
  }

  private validateExternalPaymentRegistration(status: RegistrationStatus): void {
    if (isApplicationStatus(status)) {
      throw new BadRequestException(
        'Cannot record payment for a registration in the application phase'
      );
    }

    if (status === RegistrationStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment for a cancelled registration');
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  /**
   * Records a manual refund that already completed outside PlayaPlan.
   */
  async createManualRefund(
    paymentId: string,
    data: CreateRefundDto,
    adminUserId: string
  ): Promise<ManualRefundResult> {
    const canonicalRequest = this.canonicalizeManualRefund(data);

    try {
      return await this.prisma.$transaction(
        async tx => {
          const existingRefund = await tx.paymentRefund.findUnique({
            where: { idempotencyKey: data.idempotencyKey },
            select: internalRefundSelect,
          });

          if (existingRefund && existingRefund.paymentId !== paymentId) {
            throw new ConflictException(
              'Idempotency key has already been used with different refund data'
            );
          }

          const payment = await tx.payment.findUnique({
            where: { id: paymentId },
            select: adminPaymentSelect,
          });

          if (!payment) {
            throw new NotFoundException(`Payment with ID ${paymentId} not found`);
          }

          if (existingRefund) {
            const replayAudit = await tx.adminAudit.findFirst({
              where: {
                transactionId: data.idempotencyKey,
                actionType: AdminAuditActionType.PAYMENT_REFUND,
                targetRecordType: AdminAuditTargetType.PAYMENT,
                targetRecordId: paymentId,
              },
              select: { newValues: true },
            });

            return this.resolveManualRefundReplay(
              payment,
              existingRefund,
              replayAudit?.newValues,
              canonicalRequest
            );
          }

          this.validateManualRefundPayment(payment.status);
          this.validateManualRefundRegistration(
            payment.registrationId,
            payment.registration?.status ?? null,
            canonicalRequest.resultingRegistrationStatus
          );

          const paymentCurrency = this.getPaymentCurrency(payment.currency);
          const paymentAmountCents = this.getPaymentAmountCents(payment.amount);
          const currentTotals = this.calculateRefundTotals(paymentAmountCents, payment.refunds);
          if (currentTotals.availableRefundCents <= 0) {
            throw new BadRequestException('Payment has no refundable balance available');
          }

          const refundAmountCents = canonicalRequest.fullRefund
            ? currentTotals.availableRefundCents
            : canonicalRequest.amountCents;
          if (
            refundAmountCents === undefined ||
            refundAmountCents > currentTotals.availableRefundCents
          ) {
            throw new BadRequestException(
              `Refund amount exceeds available balance of ${currentTotals.availableRefundCents} cents`
            );
          }

          const createdRefund = await tx.paymentRefund.create({
            data: {
              paymentId,
              amountCents: refundAmountCents,
              currency: paymentCurrency,
              executionMode: RefundExecutionMode.MANUAL,
              status: PaymentRefundStatus.SUCCEEDED,
              reason: canonicalRequest.reason,
              externalReference: canonicalRequest.externalReference,
              idempotencyKey: data.idempotencyKey,
              processedByUserId: adminUserId,
              resultingRegistrationStatus: canonicalRequest.resultingRegistrationStatus,
            },
            select: internalRefundSelect,
          });

          const successfulRefundCents = currentTotals.successfulRefundCents + refundAmountCents;
          const resultingPaymentStatus =
            successfulRefundCents === paymentAmountCents
              ? PaymentStatus.REFUNDED
              : PaymentStatus.PARTIALLY_REFUNDED;

          await tx.payment.update({
            where: { id: paymentId },
            data: { status: resultingPaymentStatus },
          });

          if (payment.registrationId && canonicalRequest.resultingRegistrationStatus) {
            await tx.registration.update({
              where: { id: payment.registrationId },
              data: {
                status: canonicalRequest.resultingRegistrationStatus,
              },
            });
          }

          await tx.adminAudit.create({
            data: {
              adminUserId,
              actionType: AdminAuditActionType.PAYMENT_REFUND,
              targetRecordType: AdminAuditTargetType.PAYMENT,
              targetRecordId: paymentId,
              transactionId: data.idempotencyKey,
              newValues: {
                outcome: PaymentRefundStatus.SUCCEEDED,
                paymentId,
                refundId: createdRefund.id,
                registrationId: payment.registrationId,
                amountCents: refundAmountCents,
                currency: paymentCurrency,
                executionMode: RefundExecutionMode.MANUAL,
                reason: canonicalRequest.reason,
                externalReference: canonicalRequest.externalReference,
                resultingRegistrationStatus: canonicalRequest.resultingRegistrationStatus,
                requestedFullRefund: canonicalRequest.fullRefund,
              },
              reason: canonicalRequest.reason,
            },
          });

          const updatedPayment = await tx.payment.findUnique({
            where: { id: paymentId },
            select: adminPaymentSelect,
          });
          if (!updatedPayment) {
            throw new NotFoundException(`Payment with ID ${paymentId} not found after refund`);
          }

          return this.buildManualRefundResult(updatedPayment, createdRefund);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error: unknown) {
      if (this.isSerializationConflict(error)) {
        throw new ConflictException(
          'Refund balance changed concurrently; refresh the payment and retry'
        );
      }

      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const replay = await this.findManualRefundReplay(
        paymentId,
        data.idempotencyKey,
        canonicalRequest
      );
      if (!replay) {
        throw error;
      }

      return replay;
    }
  }

  private canonicalizeManualRefund(data: CreateRefundDto): CanonicalManualRefund {
    if (data.executionMode !== RefundExecutionMode.MANUAL) {
      throw new BadRequestException(
        'Only MANUAL executionMode is supported for this refund command'
      );
    }

    const hasAmount = data.amountCents !== undefined;
    const hasFullRefund = data.fullRefund !== undefined;
    if (
      hasAmount === hasFullRefund ||
      (hasFullRefund && data.fullRefund !== true)
    ) {
      throw new BadRequestException(
        'Provide exactly one of a positive integer amountCents or fullRefund: true'
      );
    }

    if (hasAmount) {
      this.validateRefundAmountCents(data.amountCents);
    }

    this.validateResultingRegistrationStatus(data.resultingRegistrationStatus);

    return {
      amountCents: data.amountCents,
      fullRefund: data.fullRefund === true,
      executionMode: RefundExecutionMode.MANUAL,
      reason: this.canonicalizeRefundText(data.reason, REFUND_REASON_MAX_LENGTH, 'reason'),
      externalReference: this.canonicalizeRefundText(
        data.externalReference,
        REFUND_EXTERNAL_REFERENCE_MAX_LENGTH,
        'externalReference'
      ),
      resultingRegistrationStatus: data.resultingRegistrationStatus ?? null,
    };
  }

  private validateRefundAmountCents(amountCents: number | undefined): void {
    if (amountCents === undefined || amountCents <= 0) {
      throw new BadRequestException(
        'amountCents must be a positive integer within the supported range'
      );
    }

    try {
      centsToDollars(amountCents);
    } catch (error: unknown) {
      if (error instanceof RangeError) {
        throw new BadRequestException(
          'amountCents must be a positive integer within the supported range'
        );
      }

      throw error;
    }
  }

  private canonicalizeRefundText(
    value: string | undefined,
    maxLength: number,
    fieldName: 'reason' | 'externalReference'
  ): string | null {
    const normalizedValue = value?.trim() || null;
    if (normalizedValue && normalizedValue.length > maxLength) {
      throw new BadRequestException(
        `${fieldName} must not exceed ${maxLength} characters after sanitization`
      );
    }

    return normalizedValue;
  }

  private validateManualRefundPayment(status: PaymentStatus): void {
    if (status !== PaymentStatus.COMPLETED && status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new BadRequestException(`Cannot refund payment with status ${status}`);
    }
  }

  private validateManualRefundRegistration(
    registrationId: string | null,
    currentStatus: RegistrationStatus | null,
    resultingStatus: RegistrationStatus | null
  ): void {
    if (!resultingStatus) {
      return;
    }

    if (!registrationId || !currentStatus) {
      throw new BadRequestException(
        'Cannot apply a registration status to a payment without a registration'
      );
    }

    if (currentStatus === RegistrationStatus.CANCELLED || isApplicationStatus(currentStatus)) {
      throw new BadRequestException(
        `Cannot change a registration from ${currentStatus} during a refund; use the cancellation workflow when cancellation is intended`
      );
    }
  }

  private validateResultingRegistrationStatus(status: RegistrationStatus | undefined): void {
    if (
      status === undefined ||
      status === RegistrationStatus.PENDING ||
      status === RegistrationStatus.CONFIRMED ||
      status === RegistrationStatus.WAITLISTED
    ) {
      return;
    }

    throw new BadRequestException(
      'resultingRegistrationStatus must be PENDING, CONFIRMED, or WAITLISTED; use the cancellation workflow to cancel a registration'
    );
  }

  private getPaymentAmountCents(amount: number): number {
    try {
      return dollarsToCents(amount);
    } catch (error: unknown) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private validateStoredPaymentCurrency(currency: string): void {
    const normalizedCurrency = normalizeCurrency(currency);
    if (normalizedCurrency !== currency) {
      throw new RangeError('Stored payment currency must already be normalized');
    }
  }

  private getPaymentCurrency(currency: string): string {
    try {
      this.validateStoredPaymentCurrency(currency);
      return currency;
    } catch (error: unknown) {
      if (error instanceof RangeError) {
        throw new BadRequestException(UNSUPPORTED_PAYMENT_CURRENCY_REASON);
      }

      throw error;
    }
  }

  private resolveManualRefundReplay(
    payment: AdminPaymentRecord,
    existingRefund: InternalRefundRecord,
    auditValues: Prisma.JsonValue | null | undefined,
    canonicalRequest: CanonicalManualRefund
  ): ManualRefundResult {
    const requestedFullRefund = this.getRequestedFullRefundFromAudit(auditValues);
    const amountMatches =
      canonicalRequest.fullRefund || existingRefund.amountCents === canonicalRequest.amountCents;

    if (
      requestedFullRefund === null ||
      requestedFullRefund !== canonicalRequest.fullRefund ||
      !amountMatches ||
      existingRefund.executionMode !== canonicalRequest.executionMode ||
      existingRefund.reason !== canonicalRequest.reason ||
      existingRefund.externalReference !== canonicalRequest.externalReference ||
      existingRefund.resultingRegistrationStatus !== canonicalRequest.resultingRegistrationStatus
    ) {
      throw new ConflictException(
        'Idempotency key has already been used with different refund data'
      );
    }

    return this.buildManualRefundResult(payment, existingRefund);
  }

  private getRequestedFullRefundFromAudit(
    auditValues: Prisma.JsonValue | null | undefined
  ): boolean | null {
    if (
      typeof auditValues !== 'object' ||
      auditValues === null ||
      Array.isArray(auditValues) ||
      !('requestedFullRefund' in auditValues) ||
      typeof auditValues.requestedFullRefund !== 'boolean'
    ) {
      return null;
    }

    return auditValues.requestedFullRefund;
  }

  private buildManualRefundResult(
    payment: AdminPaymentRecord,
    refund: InternalRefundRecord
  ): ManualRefundResult {
    const adminPayment = this.toAdminPayment(payment);

    return {
      payment: adminPayment,
      refund: {
        id: refund.id,
        amountCents: refund.amountCents,
        currency: refund.currency,
        executionMode: refund.executionMode,
        status: refund.status,
        reason: refund.reason,
        externalReference: refund.externalReference,
        resultingRegistrationStatus: refund.resultingRegistrationStatus,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt,
      },
      paymentAmountCents: adminPayment.paymentAmountCents,
      successfulRefundCents: adminPayment.successfulRefundCents,
      pendingRefundCents: adminPayment.pendingRefundCents,
      availableRefundCents: adminPayment.availableRefundCents,
      refundUnavailableReason: adminPayment.refundUnavailableReason,
    };
  }

  private async findManualRefundReplay(
    paymentId: string,
    idempotencyKey: string,
    canonicalRequest: CanonicalManualRefund
  ): Promise<ManualRefundResult | null> {
    const existingRefund = await this.prisma.paymentRefund.findUnique({
      where: { idempotencyKey },
      select: internalRefundSelect,
    });
    if (!existingRefund) {
      return null;
    }

    if (existingRefund.paymentId !== paymentId) {
      throw new ConflictException(
        'Idempotency key has already been used with different refund data'
      );
    }

    const [payment, replayAudit] = await Promise.all([
      this.prisma.payment.findUnique({
        where: { id: paymentId },
        select: adminPaymentSelect,
      }),
      this.prisma.adminAudit.findFirst({
        where: {
          transactionId: idempotencyKey,
          actionType: AdminAuditActionType.PAYMENT_REFUND,
          targetRecordType: AdminAuditTargetType.PAYMENT,
          targetRecordId: paymentId,
        },
        select: { newValues: true },
      }),
    ]);
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    return this.resolveManualRefundReplay(
      payment,
      existingRefund,
      replayAudit?.newValues,
      canonicalRequest
    );
  }

  private isSerializationConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
  }

  /**
   * Initiate a payment with Stripe
   * @param data - Stripe payment data
   * @returns Payment intent or checkout session information
   */
  async initiateStripePayment(
    data: CreateStripePaymentDto
  ): Promise<{ paymentId: string; clientSecret?: string; url?: string }> {
    try {
      this.logger.log(
        `Initiating Stripe payment for user ${data.userId}, registrationId: ${data.registrationId || 'none'}, amount: ${data.amount}`
      );

      // Create checkout session
      const session = await this.stripeService.createCheckoutSession(data);

      // Create payment record
      const payment = await this.create({
        amount: data.amount / 100, // Convert from cents
        currency: data.currency,
        provider: PaymentProvider.STRIPE,
        userId: data.userId,
        registrationId: data.registrationId,
        providerRefId: session.id,
      });

      return {
        paymentId: payment.id,
        url: session.url || undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to initiate Stripe payment: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Initiate a payment with PayPal
   * @param data - PayPal payment data
   * @returns PayPal order information with approval URL
   */
  async initiatePaypalPayment(
    data: CreatePaypalPaymentDto
  ): Promise<{ paymentId: string; orderId: string; approvalUrl: string }> {
    try {
      // Create PayPal order
      const order = await this.paypalService.createOrder(data);

      // Find approval URL
      const approvalUrl = order.links.find((link: PayPalLink) => link.rel === 'approve')?.href;

      if (!approvalUrl) {
        throw new BadRequestException('PayPal order missing approval URL');
      }

      // Create payment record
      const payment = await this.create({
        amount: data.amount,
        currency: data.currency,
        provider: PaymentProvider.PAYPAL,
        userId: data.userId,
        registrationId: data.registrationId,
        providerRefId: order.id,
      });

      return {
        paymentId: payment.id,
        orderId: order.id,
        approvalUrl,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to initiate PayPal payment: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Process a PayPal webhook event
   * Not yet implemented - would be similar to Stripe webhook handling
   */
  async handlePaypalWebhook(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload: Record<string, unknown>
  ): Promise<{ received: boolean; type: string }> {
    // Implementation would be similar to Stripe webhook handling
    // PayPal webhooks have their own format and verification methods
    this.logger.log('PayPal webhook received, but handling not yet implemented');

    return { received: true, type: 'paypal.webhook' };
  }

  /**
   * Process a refund
   * @param data - Refund data
   * @returns Refund processing result
   */
  async processRefund(data: LegacyRefundRequest): Promise<RefundResult> {
    // Check if payment exists
    const payment = await this.findOne(data.paymentId);

    // Can only refund completed payments
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(`Cannot refund payment with status ${payment.status}`);
    }

    try {
      // Calculate refund amount
      let refundAmount = data.amount;

      if (!refundAmount && data.percentageOfOriginal) {
        refundAmount = (payment.amount * data.percentageOfOriginal) / 100;
      }

      if (!refundAmount) {
        refundAmount = payment.amount; // Full refund
      }

      // Process refund with payment provider
      let providerRefund: ProviderRefund;

      if (payment.provider === PaymentProvider.STRIPE) {
        if (!payment.providerRefId) {
          throw new BadRequestException('Payment has no provider reference ID');
        }

        // Convert from dollars (database) to cents (Stripe expects cents)
        const refundAmountCents = Math.round(refundAmount * 100);

        providerRefund = await this.stripeService.createRefund(
          payment.providerRefId,
          refundAmountCents,
          data.reason
        );
      } else if (payment.provider === PaymentProvider.PAYPAL) {
        if (!payment.providerRefId) {
          throw new BadRequestException('Payment has no provider reference ID');
        }

        // Use dollar amount as-is since PayPal expects dollar amounts and database stores in dollars
        providerRefund = await this.paypalService.createRefund(
          payment.providerRefId,
          refundAmount,
          data.reason
        );
      } else {
        // Manual refund (just update the database)
        providerRefund = { id: `manual-refund-${Date.now()}` };
      }

      // Update payment status
      await this.update(payment.id, {
        status: PaymentStatus.REFUNDED,
        // notes field removed as it's not in the Prisma schema
      });

      // If there's a registration, update its status
      if (payment.registration) {
        await this.prisma.registration.update({
          where: { id: payment.registration.id },
          data: { status: 'CANCELLED' },
        });
      }

      return {
        paymentId: payment.id,
        refundAmount,
        providerRefundId: providerRefund.id,
        success: true,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to process refund: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Verify a Stripe checkout session and return payment/registration status
   * This method checks the actual Stripe session status and updates our records accordingly
   * @param sessionId - Stripe checkout session ID
   * @returns Session verification result with payment and registration info
   */
  async verifyStripeSession(sessionId: string): Promise<{
    sessionId: string;
    paymentStatus: PaymentStatus;
    registrationId?: string;
    registrationStatus?: string;
    paymentId?: string;
  }> {
    try {
      // Find payment with this session ID
      const payment = (await this.prisma.payment.findFirst({
        where: { providerRefId: sessionId },
        include: { registration: true },
      })) as PaymentWithRelations;

      if (!payment) {
        throw new NotFoundException(`Payment not found for Stripe session ${sessionId}`);
      }

      this.logger.log(
        `Found payment ${payment.id} for session ${sessionId}, registration: ${payment.registration?.id || 'none'}, registration status: ${payment.registration?.status || 'none'}`
      );

      // Get the actual session status from Stripe
      const stripeSession = await this.stripeService.getCheckoutSession(sessionId);

      this.logger.log(
        `Stripe session ${sessionId} status: ${stripeSession.status}, payment_status: ${stripeSession.payment_status}`
      );

      // Determine the payment status based on Stripe session
      let updatedPaymentStatus = payment.status;
      let updatedRegistrationStatus = payment.registration?.status;

      if (stripeSession.payment_status === 'paid') {
        // Payment was successful - mark payment and registration as complete
        updatedPaymentStatus = PaymentStatus.COMPLETED;

        if (payment.registration) {
          // Capacity beats payment: a WAITLISTED registration must NOT be
          // promoted to CONFIRMED just because the user paid. The
          // standard waitlist flow (admin or capacity-opens-up) is the
          // only path that should transition WAITLISTED → CONFIRMED.
          // We still record the payment as COMPLETED and clear
          // `paymentDeferred` so the row reflects the paid state, but
          // the status stays WAITLISTED.
          //
          // This is the only WAITLISTED-deferred interaction that is
          // actually reachable via this PR's new UI: the dashboard's
          // "Pay Now" CTA hides itself for WAITLISTED registrations
          // (DashboardPage.tsx), but a direct API call or a TOCTOU race
          // that produced a WAITLISTED + paymentDeferred=true row would
          // expose the bug this guard prevents. Pre-#160, this method
          // always set the registration to CONFIRMED on paid sessions
          // — a latent issue that became reachable once dashboard
          // "Pay Now" was added.
          const isWaitlisted = payment.registration.status === 'WAITLISTED';
          updatedRegistrationStatus = isWaitlisted ? 'WAITLISTED' : 'CONFIRMED';
          const targetStatus = updatedRegistrationStatus;

          // Update path fires when ANY of (a) payment not yet COMPLETED,
          // (b) registration not at its target status (CONFIRMED unless
          // WAITLISTED, in which case it stays WAITLISTED), (c) registration
          // still flagged paymentDeferred=true. The third clause matters
          // for deferred registrations: a deferred row starts as CONFIRMED
          // + paymentDeferred=true, so without this clause a retry after
          // payment would skip the update and leave paymentDeferred true.
          if (
            payment.status !== PaymentStatus.COMPLETED ||
            payment.registration.status !== targetStatus ||
            payment.registration.paymentDeferred
          ) {
            try {
              this.logger.log(
                `Updating payment ${payment.id} to COMPLETED and registration ${payment.registration.id} to ${targetStatus} (paymentDeferred cleared)`
              );

              try {
                // Use transaction to ensure atomicity between payment and registration updates
                const transactionResults = await this.prisma.$transaction([
                  this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: PaymentStatus.COMPLETED },
                  }),
                  this.prisma.registration.update({
                    where: { id: payment.registration.id },
                    data: { status: targetStatus, paymentDeferred: false },
                  }),
                ]);

                this.logger.log(`Successfully updated payment and registration statuses`);
                this.logger.debug(
                  `Transaction results: ${JSON.stringify({
                    payment: transactionResults[0].id,
                    registration: transactionResults[1].id,
                  })}`
                );

                // Send registration confirmation email with the updated
                // status — but skip it for a deferred → paid transition,
                // because the participant already received a confirmation
                // email at registration creation time (with a "payment
                // deferred" notice). Sending it again would duplicate.
                const wasDeferred = payment.registration.paymentDeferred === true;
                if (!wasDeferred) {
                  this.sendRegistrationConfirmationEmailAfterPayment(payment.registration.id).catch(
                    emailError => {
                      this.logger.warn(
                        `Failed to send registration confirmation email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`
                      );
                    }
                  );
                }
              } catch (transactionError) {
                // If the transaction fails, at least try to update the payment status
                // This ensures we record the successful Stripe payment even if registration update fails
                this.logger.warn(
                  `Transaction failed, falling back to payment-only update: ${transactionError instanceof Error ? transactionError.message : 'Unknown error'}`
                );

                if (payment.status !== PaymentStatus.COMPLETED) {
                  await this.prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                      status: PaymentStatus.COMPLETED,
                    },
                  });
                  this.logger.log(
                    `Updated payment ${payment.id} to COMPLETED (registration update failed: ${transactionError instanceof Error ? transactionError.message : 'Unknown error'})`
                  );
                }
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(
                `Failed to update statuses: ${errorMessage}`,
                error instanceof Error ? error.stack : undefined
              );
              throw new BadRequestException(
                `Failed to update payment or registration status: ${errorMessage}`
              );
            }
          } else {
            this.logger.log(
              `Both payment and registration already have correct statuses, no update needed`
            );
          }
        } else {
          // No registration linked, just update the payment if needed
          if (payment.status !== PaymentStatus.COMPLETED) {
            await this.update(payment.id, {
              status: PaymentStatus.COMPLETED,
            });
            this.logger.log(`Updated payment ${payment.id} to COMPLETED (no registration)`);
          } else {
            this.logger.log(`Payment ${payment.id} already marked as COMPLETED (no registration)`);
          }
        }
      } else if (
        stripeSession.payment_status === 'unpaid' &&
        payment.status === PaymentStatus.PENDING
      ) {
        // Payment is still pending or failed
        if (stripeSession.status === 'expired') {
          this.logger.log(
            `Updating payment ${payment.id} status to FAILED based on expired Stripe session`
          );

          await this.update(payment.id, {
            status: PaymentStatus.FAILED,
            // notes field removed as it's not in the Prisma schema
          });

          updatedPaymentStatus = PaymentStatus.FAILED;
        }
      }

      return {
        sessionId,
        paymentStatus: updatedPaymentStatus,
        registrationId: payment.registration?.id,
        registrationStatus: updatedRegistrationStatus,
        paymentId: payment.id,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to verify Stripe session: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new BadRequestException('Failed to verify Stripe session');
    }
  }

  /**
   * Send registration confirmation email after payment completion
   * @param registrationId - The registration ID
   */
  private async sendRegistrationConfirmationEmailAfterPayment(
    registrationId: string
  ): Promise<void> {
    try {
      // Get the updated registration with all necessary data
      const registration = await this.prisma.registration.findUnique({
        where: { id: registrationId },
        include: {
          user: true,
          jobs: {
            include: {
              job: {
                include: {
                  category: true,
                  shift: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      if (!registration) {
        this.logger.warn(`Registration ${registrationId} not found for confirmation email`);
        return;
      }

      // Get camping option registrations for this registration
      const campingOptionRegistrations = await this.prisma.campingOptionRegistration.findMany({
        where: { userId: registration.userId, registrationId },
        include: {
          campingOption: {
            include: { fields: true },
          },
        },
      });

      // Calculate total cost from camping options
      const totalCost = campingOptionRegistrations.reduce((total, reg) => {
        return total + (reg.campingOption?.participantDues || 0);
      }, 0);

      // Format camping options
      const campingOptions = campingOptionRegistrations.map(reg => ({
        name: reg.campingOption?.name || 'Unknown',
        description: reg.campingOption?.description || undefined,
      }));

      // Format jobs from registration
      const jobs =
        registration.jobs?.map(regJob => ({
          name: regJob.job?.name || 'Unknown Job',
          category: regJob.job?.category?.name || 'Unknown Category',
          shift: {
            name: regJob.job?.shift?.name || 'Unknown Shift',
            startTime: regJob.job?.shift?.startTime || '',
            endTime: regJob.job?.shift?.endTime || '',
            dayOfWeek: regJob.job?.shift?.dayOfWeek || '',
          },
          location: regJob.job?.location || 'TBD',
        })) || [];

      const registrationDetails = {
        id: registration.id,
        year: registration.year,
        status: registration.status, // This should now be 'CONFIRMED'
        campingOptions,
        jobs,
        totalCost: totalCost > 0 ? totalCost * 100 : undefined, // Convert to cents
        currency: 'USD',
      };

      // Build user name for email personalization
      const userName =
        registration.user.firstName && registration.user.lastName
          ? `${registration.user.firstName} ${registration.user.lastName}`
          : undefined;

      await this.notificationsService.sendRegistrationConfirmationEmail(
        registration.user.email,
        registrationDetails,
        registration.userId,
        userName,
        registration.user.playaName || undefined
      );

      this.logger.log(
        `Registration confirmation email sent to ${registration.user.email} with status ${registration.status}`
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error sending registration confirmation email after payment: ${err.message}`,
        err.stack
      );
      // Don't throw - email failures should not block payment processing
    }
  }
}
