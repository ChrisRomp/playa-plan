import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CreatePaymentDto, UpdatePaymentDto, CreateRefundDto, RecordManualPaymentDto, CreateStripePaymentDto, CreatePaypalPaymentDto } from '../dto';
import {
  AdminAuditActionType,
  AdminAuditTargetType,
  Payment,
  PaymentProvider,
  PaymentRefund,
  PaymentRefundStatus,
  PaymentStatus,
  Prisma,
  Registration,
  RegistrationStatus,
  UserRole,
} from '@prisma/client';
import { StripeRefundError, StripeService } from './stripe.service';
import { PaypalService } from './paypal.service';
import { isApplicationStatus } from '../../registrations/constants/registration-status.constants';
import { AdminAuditService } from '../../admin-audit/services/admin-audit.service';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';

// Create an extended Payment type that includes registration relationship
type PaymentWithRelations = Payment & {
  registration?: Registration | null;
  refunds?: PaymentRefund[];
};

type RefundablePayment = Payment & {
  registration: Registration | null;
  refunds: PaymentRefund[];
};

type RefundAmounts = Pick<PaymentRefund, 'status' | 'amountCents'>;

const PARTICIPANT_REFUND_SELECT = {
  id: true,
  paymentId: true,
  amountCents: true,
  currency: true,
  status: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Interface for PayPal link object
interface PayPalLink {
  rel: string;
  href: string;
}

// Interface for Prisma where clause
export interface PaymentOverview extends Payment {
  refundedAmount: number;
  netAmount: number;
  refundableAmount: number;
  processorRefundAvailable: boolean;
  refunds: PaymentRefund[];
}

export interface ParticipantRefundView {
  readonly id: string;
  readonly paymentId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly status: PaymentRefundStatus;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type ParticipantPaymentOverview = Omit<PaymentOverview, 'refunds'> & {
  readonly refunds: readonly ParticipantRefundView[];
};

export type ParticipantPaymentDetail = Payment & {
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  registration?: Registration | null;
  refunds: readonly ParticipantRefundView[];
};

// Interface for refund result
export interface RefundResult {
  paymentId: string;
  refundAmount: number;
  providerRefundId: string;
  success: boolean;
  refundStatus: PaymentRefundStatus;
}

interface ProcessRefundOptions {
  readonly allowRegistrationCancellation?: boolean;
}

// Interface for provider refund response
interface ProviderRefund {
  id: string;
  status?: string | null;
}

interface RefundFinalization {
  readonly refund: PaymentRefund;
  readonly payment: RefundablePayment;
  readonly nextStatus: PaymentStatus;
  readonly previousRefundedCents: number;
  readonly appliedRegistrationStatus?: RegistrationStatus;
  /** Refund lifecycle status prior to this finalization, when one existed (e.g. PENDING). */
  readonly previousRefundStatus?: PaymentRefundStatus;
}

// Result of reconciling pending processor refunds without submitting a new refund.
export interface RefundReconciliationResult {
  readonly payment: PaymentOverview;
  readonly reconciledRefundIds: readonly string[];
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
    private readonly notificationsService: NotificationsService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  private toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  private validateSupportedAmountCents(amountCents: number, label: string): void {
    if (amountCents > PAYMENT_AMOUNT_LIMITS.cents) {
      throw new BadRequestException(
        `${label} amount exceeds the supported maximum of ${PAYMENT_AMOUNT_LIMITS.majorUnits}`,
      );
    }
  }

  private toDollars(amountCents: number): number {
    return amountCents / 100;
  }

  private getSucceededRefundCents(refunds: RefundAmounts[] = []): number {
    return refunds
      .filter((refund) => refund.status === PaymentRefundStatus.SUCCEEDED)
      .reduce((sum, refund) => sum + refund.amountCents, 0);
  }

  private getReservedRefundCents(refunds: RefundAmounts[] = []): number {
    return refunds
      .filter((refund) => refund.status === PaymentRefundStatus.SUCCEEDED || refund.status === PaymentRefundStatus.PENDING)
      .reduce((sum, refund) => sum + refund.amountCents, 0);
  }

  private getPaymentStatusFromRefunds(paymentAmountCents: number, refundedCents: number): PaymentStatus {
    if (refundedCents <= 0) {
      return PaymentStatus.COMPLETED;
    }

    if (refundedCents >= paymentAmountCents) {
      return PaymentStatus.REFUNDED;
    }

    return PaymentStatus.PARTIALLY_REFUNDED;
  }

  private getAppliedRegistrationStatus(
    registration: Registration | null,
    requestedStatus?: RegistrationStatus | null,
  ): RegistrationStatus | undefined {
    if (
      !registration ||
      !requestedStatus ||
      requestedStatus === registration.status ||
      registration.status === RegistrationStatus.CANCELLED
    ) {
      return undefined;
    }

    return requestedStatus;
  }

  private isRefundableStatus(status: PaymentStatus): boolean {
    return status === PaymentStatus.COMPLETED || status === PaymentStatus.PARTIALLY_REFUNDED;
  }

  private isProcessorRefundProvider(provider: PaymentProvider): boolean {
    return provider === PaymentProvider.STRIPE;
  }

  private shouldCompletePaymentFromPaidSession(status: PaymentStatus): boolean {
    return status !== PaymentStatus.COMPLETED &&
      status !== PaymentStatus.PARTIALLY_REFUNDED &&
      status !== PaymentStatus.REFUNDED;
  }

  private getRefundStatusFromProviderStatus(status?: string | null): PaymentRefundStatus {
    const normalizedStatus = status?.toLowerCase();

    if (normalizedStatus === 'succeeded' || normalizedStatus === 'completed') {
      return PaymentRefundStatus.SUCCEEDED;
    }

    if (normalizedStatus === 'failed' || normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
      return PaymentRefundStatus.FAILED;
    }

    return PaymentRefundStatus.PENDING;
  }

  private getPaymentOverview<
    TRefund extends RefundAmounts,
    TPayment extends Payment & { refunds?: TRefund[] },
  >(payment: TPayment): TPayment & Omit<PaymentOverview, 'refunds'> & { refunds: TRefund[] } {
    const amountCents = this.toCents(payment.amount);
    const succeededRefundCents = this.getSucceededRefundCents(payment.refunds ?? []);
    const reservedRefundCents = this.getReservedRefundCents(payment.refunds ?? []);
    const isLegacyRefundedPayment = payment.status === PaymentStatus.REFUNDED && succeededRefundCents === 0;
    const refundedCents = isLegacyRefundedPayment ? amountCents : succeededRefundCents;
    const reservedCents = isLegacyRefundedPayment ? amountCents : reservedRefundCents;
    const refundableCents = this.isRefundableStatus(payment.status)
      ? Math.max(amountCents - reservedCents, 0)
      : 0;

    return {
      ...payment,
      refundedAmount: this.toDollars(refundedCents),
      netAmount: this.toDollars(Math.max(amountCents - refundedCents, 0)),
      refundableAmount: this.toDollars(refundableCents),
      processorRefundAvailable: this.isRefundableStatus(payment.status) &&
        this.isProcessorRefundProvider(payment.provider) &&
        !!payment.providerRefId &&
        !payment.providerRefId.startsWith('manual') &&
        refundableCents > 0,
      refunds: payment.refunds ?? [],
    };
  }

  private async finalizeProcessorRefund(
    refund: PaymentRefund,
    providerRefund: ProviderRefund,
  ): Promise<RefundFinalization | null> {
    const previousRefundStatus = refund.status;
    const providerRefundStatus = this.getRefundStatusFromProviderStatus(providerRefund.status);
    const pendingRefundWhere: Prisma.PaymentRefundWhereInput = {
      id: refund.id,
      status: PaymentRefundStatus.PENDING,
      ...(providerRefundStatus === PaymentRefundStatus.PENDING && {
        OR: [
          { providerRefundId: null },
          { providerRefundId: { not: providerRefund.id } },
        ],
      }),
    };

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.paymentRefund.updateMany({
        where: pendingRefundWhere,
        data: {
          status: providerRefundStatus,
          providerRefundId: providerRefund.id,
        },
      });

      if (count === 0) {
        // Another request already finalized this refund or recorded the same pending
        // provider state, so do not duplicate side effects or audit records.
        return null;
      }

      const finalizedRefund: PaymentRefund = {
        ...refund,
        status: providerRefundStatus,
        providerRefundId: providerRefund.id,
      };

      const payment = await tx.payment.findUnique({
        where: { id: refund.paymentId },
        include: {
          registration: true,
          refunds: true,
        },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${refund.paymentId} not found`);
      }

      const refundedCents = this.getSucceededRefundCents(payment.refunds);
      const nextStatus = this.getPaymentStatusFromRefunds(this.toCents(payment.amount), refundedCents);
      const previousRefundedCents = finalizedRefund.status === PaymentRefundStatus.SUCCEEDED
        ? Math.max(refundedCents - finalizedRefund.amountCents, 0)
        : refundedCents;
      const appliedRegistrationStatus = finalizedRefund.status === PaymentRefundStatus.SUCCEEDED
        ? this.getAppliedRegistrationStatus(
          payment.registration,
          finalizedRefund.resultingRegistrationStatus,
        )
        : undefined;

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: nextStatus },
      });

      if (payment.registration && appliedRegistrationStatus) {
        await tx.registration.update({
          where: { id: payment.registration.id },
          data: { status: appliedRegistrationStatus },
        });
      }

      return {
        refund: finalizedRefund,
        payment,
        nextStatus,
        previousRefundedCents,
        appliedRegistrationStatus,
        previousRefundStatus,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private async createRefundAudit(
    finalization: RefundFinalization,
    transactionId: string,
    auditActorId?: string,
  ): Promise<void> {
    await this.adminAuditService.createAuditRecord({
      adminUserId: auditActorId ?? finalization.refund.processedByUserId,
      actionType: AdminAuditActionType.PAYMENT_REFUND,
      targetRecordType: AdminAuditTargetType.PAYMENT,
      targetRecordId: finalization.payment.id,
      oldValues: {
        status: finalization.payment.status,
        refundedAmount: this.toDollars(finalization.previousRefundedCents),
        ...(finalization.previousRefundStatus !== undefined && {
          refundStatus: finalization.previousRefundStatus,
        }),
      },
      newValues: {
        status: finalization.nextStatus,
        refundId: finalization.refund.id,
        refundAmount: this.toDollars(finalization.refund.amountCents),
        refundAmountCents: finalization.refund.amountCents,
        // Lifecycle status of this specific refund (PENDING/SUCCEEDED/FAILED), distinct from
        // the payment-level status above, so pending, succeeded, and failed submissions are
        // distinguishable in the audit trail.
        refundStatus: finalization.refund.status,
        providerRefundId:
          finalization.refund.providerRefundId ??
          (finalization.refund.processorRefund ? undefined : finalization.refund.id),
        processorRefund: finalization.refund.processorRefund,
        resultingRegistrationStatus: finalization.appliedRegistrationStatus,
      },
      reason: finalization.refund.reason ?? undefined,
      transactionId,
      throwOnError: false,
    });

    if (finalization.payment.registration && finalization.appliedRegistrationStatus) {
      await this.adminAuditService.createAuditRecord({
        adminUserId: auditActorId ?? finalization.refund.processedByUserId,
        actionType: AdminAuditActionType.REGISTRATION_EDIT,
        targetRecordType: AdminAuditTargetType.REGISTRATION,
        targetRecordId: finalization.payment.registration.id,
        oldValues: { status: finalization.payment.registration.status },
        newValues: { status: finalization.appliedRegistrationStatus },
        reason: finalization.refund.reason ?? undefined,
        transactionId,
        throwOnError: false,
      });
    }
  }

  private async reconcilePendingProcessorRefunds(
    payment: RefundablePayment,
    reconciledByUserId: string,
  ): Promise<string[]> {
    const pendingRefunds = payment.refunds
      .filter(
        (refund) => refund.processorRefund && refund.status === PaymentRefundStatus.PENDING,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (pendingRefunds.length === 0) {
      return [];
    }

    if (payment.provider !== PaymentProvider.STRIPE || !payment.providerRefId) {
      return [];
    }

    const reconciledRefundIds: string[] = [];

    for (const refund of pendingRefunds) {
      let providerRefund = refund.providerRefundId
        ? await this.stripeService.retrieveRefund(refund.providerRefundId)
        : await this.stripeService.findRefundByMetadata(payment.providerRefId, refund.id);

      if (!providerRefund && !refund.providerRefundId) {
        // The original submission was ambiguous (its outcome at Stripe is unknown) and
        // no matching refund was found by metadata, so it may never have reached Stripe.
        // Retry using the same idempotency key and metadata: Stripe returns the original
        // refund if it did receive the first request, or creates it safely otherwise.
        providerRefund = await this.stripeService.createRefund(
          payment.providerRefId,
          refund.amountCents,
          refund.reason ?? undefined,
          refund.id,
          {
            refundId: refund.id,
            paymentId: payment.id,
          },
        );
      }

      if (!providerRefund) {
        this.logger.warn(
          `Pending refund ${refund.id} could not be found in Stripe; leaving it pending for later reconciliation`,
        );
        continue;
      }

      const finalization = await this.finalizeProcessorRefund(refund, providerRefund);
      if (finalization === null) {
        this.logger.debug(
          `Refund state for ${refund.id} was already applied; skipping audit`,
        );
        continue;
      }
      await this.createRefundAudit(finalization, `refund-reconcile-${refund.id}`, reconciledByUserId);
      reconciledRefundIds.push(refund.id);
    }

    return reconciledRefundIds;
  }

  /**
   * Reconcile any pending processor (Stripe) refunds for a payment against the payment
   * provider without creating another local refund. If an ambiguous submission never reached
   * Stripe, the persisted refund ID is reused as the idempotency key to retry that same request.
   * This brings the payment, refund, and any linked registration state back in sync.
   * @param paymentId - Payment whose pending processor refunds should be reconciled
   * @param reconciledByUserId - ID of the admin triggering reconciliation. When provided this
   *   user is attributed as the audit actor instead of the refund's original processedByUserId,
   *   so a second admin reconciling is correctly reflected in the audit trail.
   * @returns The refreshed payment overview and the IDs of any refunds that were reconciled
   */
  async reconcilePendingRefund(
    paymentId: string,
    reconciledByUserId: string,
  ): Promise<RefundReconciliationResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        registration: true,
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    const hasPendingProcessorRefund = payment.refunds.some(
      (refund) => refund.processorRefund && refund.status === PaymentRefundStatus.PENDING,
    );

    if (!hasPendingProcessorRefund) {
      throw new BadRequestException('Payment has no pending processor refund to reconcile');
    }

    const reconciledRefundIds = await this.reconcilePendingProcessorRefunds(payment, reconciledByUserId);

    const refreshedPayment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        registration: true,
        refunds: true,
      },
    });

    if (!refreshedPayment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    return {
      payment: this.getPaymentOverview(refreshedPayment),
      reconciledRefundIds,
    };
  }

  /**
   * Create a new payment record
   * @param createPaymentDto - Payment data
   * @param recordedByUserId - ID of the authenticated admin recording the payment, derived
   *   from the request rather than accepted from the request body. Omit for
   *   processor/participant-initiated payments where no admin recorded it.
   * @param initialStatus - Initial payment status. Defaults to PENDING for processor-initiated
   *   payments; manual payments pass their final status here to create the record atomically.
   * @returns The created payment
   */
  async create(
    createPaymentDto: CreatePaymentDto,
    recordedByUserId?: string,
    initialStatus?: PaymentStatus,
  ): Promise<Payment> {
    this.logger.log(`Creating payment record for user ${createPaymentDto.userId}`);
    this.validateSupportedAmountCents(
      this.toCents(createPaymentDto.amount),
      'Payment',
    );
    
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
        throw new NotFoundException(`Registration with ID ${createPaymentDto.registrationId} not found`);
      }
      
      if (registration.userId !== createPaymentDto.userId) {
        throw new BadRequestException('Registration does not belong to the specified user');
      }

      // Prevent payments for registrations still in application phase
      if (isApplicationStatus(registration.status)) {
        throw new BadRequestException('Cannot process payment for a registration that has not completed the application process');
      }
    }
    
    try {
      const paymentData = {
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency || 'USD',
        status: initialStatus ?? PaymentStatus.PENDING,
        provider: createPaymentDto.provider,
        providerRefId: createPaymentDto.providerRefId,
        externalPaymentMethod: createPaymentDto.externalPaymentMethod,
        externalPaymentReference: createPaymentDto.externalPaymentReference,
        user: { connect: { id: createPaymentDto.userId } },
        ...(recordedByUserId && {
          recordedBy: { connect: { id: recordedByUserId } },
        }),
        ...(createPaymentDto.registrationId && {
          registration: { connect: { id: createPaymentDto.registrationId } }
        }),
      };

      return await this.prisma.payment.create({
        data: paymentData,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create payment record: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Find all payments, with filtering options
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to take (pagination)
   * @param userId - Filter by user ID
   * @param status - Filter by payment status
   * @param registrationId - Filter by registration ID
   * @param provider - Filter by payment provider
   * @param year - Filter by registration year, or payment date year when unlinked
   * @returns Paginated list of payments
   */
  async findAll(
    skip = 0,
    take = 10,
    userId?: string,
    status?: PaymentStatus,
    registrationId?: string,
    provider?: PaymentProvider,
    year?: number,
  ): Promise<{ payments: PaymentOverview[]; total: number }> {
    const where: Prisma.PaymentWhereInput = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (status) {
      where.status = status;
    }

    if (registrationId) {
      where.registrationId = registrationId;
    }

    if (provider) {
      where.provider = provider;
    }

    if (year) {
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
      where.OR = [
        { registration: { year } },
        {
          registrationId: null,
          createdAt: {
            gte: yearStart,
            lt: nextYearStart,
          },
        },
      ];
    }
    
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
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
          refunds: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);
    
    return { payments: payments.map((payment) => this.getPaymentOverview(payment)), total };
  }

  /**
   * Find payments for the authenticated participant, with restricted refund field projection.
   * Only user-facing refund fields are returned; internal fields (processedByUserId,
   * providerRefundId, processorRefund, resultingRegistrationStatus) are excluded.
   * Use this instead of findAll when the caller is a non-admin participant.
   * @param userId - ID of the authenticated participant (must be pre-validated from the request)
   * @param skip - Number of records to skip (pagination)
   * @param take - Number of records to take (pagination)
   * @param status - Filter by payment status
   * @returns Paginated list of participant-scoped payments with restricted refund fields
   */
  async findAllForParticipant(
    userId: string,
    skip = 0,
    take = 10,
    status?: PaymentStatus,
  ): Promise<{ payments: ParticipantPaymentOverview[]; total: number }> {
    const where: Prisma.PaymentWhereInput = { userId };

    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
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
          refunds: {
            select: PARTICIPANT_REFUND_SELECT,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments: payments.map((payment) => this.getPaymentOverview(payment)),
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
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
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
    userRole: UserRole,
  ): Promise<PaymentWithRelations | ParticipantPaymentDetail> {
    const isPrivileged = userRole === UserRole.ADMIN || userRole === UserRole.STAFF;

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
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (!isPrivileged && payment.userId !== userId) {
      throw new NotFoundException(`Payment with ID ${id} not found`); // Don't reveal that payment exists
    }

    if (isPrivileged) {
      return payment;
    }

    return {
      ...payment,
      refunds: payment.refunds.map((refund) => ({
        id: refund.id,
        paymentId: refund.paymentId,
        amountCents: refund.amountCents,
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt,
      })),
    };
  }

  private isRefundDerivedStatus(status: PaymentStatus): boolean {
    return status === PaymentStatus.PARTIALLY_REFUNDED || status === PaymentStatus.REFUNDED;
  }

  /**
   * Update a payment
   * @param id - Payment ID
   * @param updatePaymentDto - Data to update
   * @returns The updated payment
   */
  async update(id: string, updatePaymentDto: UpdatePaymentDto): Promise<Payment> {
    const existingPayment = await this.findOne(id);

    if (
      updatePaymentDto.status !== undefined &&
      this.isRefundDerivedStatus(existingPayment.status)
    ) {
      throw new BadRequestException(
        `Cannot manually change status of a payment with refund-derived status ${existingPayment.status}`,
      );
    }
    
    try {
      return await this.prisma.payment.update({
        where: { id },
        data: updatePaymentDto,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update payment ${id}: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
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
      throw new BadRequestException('Cannot link payment to a registration that has not completed the application process');
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
      this.logger.error(`Failed to link payment to registration: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
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
   * Record a manual payment (e.g., cash, check).
   * @param data - Manual payment data
   * @param recordedByUserId - ID of the admin recording the payment
   * @returns The created payment
   */
  async recordManualPayment(data: RecordManualPaymentDto, recordedByUserId: string): Promise<Payment> {
    const finalStatus = data.status ?? PaymentStatus.COMPLETED;

    this.validateSupportedAmountCents(this.toCents(data.amount), 'Payment');

    this.logger.log(`Recording manual payment for user ${data.userId}`);

    const payment = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: data.userId } });
      if (!user) {
        throw new NotFoundException(`User with ID ${data.userId} not found`);
      }

      const registration = data.registrationId
        ? await tx.registration.findUnique({ where: { id: data.registrationId } })
        : null;
      if (data.registrationId && !registration) {
        throw new NotFoundException(`Registration with ID ${data.registrationId} not found`);
      }
      if (registration && registration.userId !== data.userId) {
        throw new BadRequestException('Registration does not belong to the specified user');
      }
      if (registration && isApplicationStatus(registration.status)) {
        throw new BadRequestException(
          'Cannot process payment for a registration that has not completed the application process',
        );
      }

      const createdPayment = await tx.payment.create({
        data: {
          amount: data.amount,
          currency: data.currency || 'USD',
          status: finalStatus,
          provider: PaymentProvider.MANUAL,
          externalPaymentMethod: data.externalPaymentMethod,
          externalPaymentReference: data.reference,
          user: { connect: { id: data.userId } },
          recordedBy: { connect: { id: recordedByUserId } },
          ...(data.registrationId && {
            registration: { connect: { id: data.registrationId } },
          }),
        },
      });

      if (registration && finalStatus === PaymentStatus.COMPLETED) {
        const targetStatus =
          registration.status === RegistrationStatus.WAITLISTED ||
          registration.status === RegistrationStatus.CANCELLED
            ? registration.status
            : RegistrationStatus.CONFIRMED;
        await tx.registration.update({
          where: { id: registration.id },
          data: { status: targetStatus, paymentDeferred: false },
        });
      }

      return createdPayment;
    });

    await this.adminAuditService.createAuditRecord({
      adminUserId: recordedByUserId,
      actionType: AdminAuditActionType.PAYMENT_RECORD,
      targetRecordType: AdminAuditTargetType.PAYMENT,
      targetRecordId: payment.id,
      newValues: {
        amount: data.amount,
        currency: data.currency ?? 'USD',
        provider: PaymentProvider.MANUAL,
        status: finalStatus,
        externalPaymentMethod: data.externalPaymentMethod,
        externalPaymentReference: data.reference,
        userId: data.userId,
        registrationId: data.registrationId,
      },
      reason: data.reference,
      throwOnError: false,
    });

    return payment;
  }

  /**
   * Initiate a payment with Stripe
   * @param data - Stripe payment data
   * @returns Payment intent or checkout session information
   */
  async initiateStripePayment(data: CreateStripePaymentDto): Promise<{ paymentId: string; clientSecret?: string; url?: string }> {
    try {
      this.logger.log(`Initiating Stripe payment for user ${data.userId}, registrationId: ${data.registrationId || 'none'}, amount: ${data.amount}`);
      
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
      this.logger.error(`Failed to initiate Stripe payment: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Initiate a payment with PayPal
   * @param data - PayPal payment data
   * @returns PayPal order information with approval URL
   */
  async initiatePaypalPayment(data: CreatePaypalPaymentDto): Promise<{ paymentId: string; orderId: string; approvalUrl: string }> {
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
      this.logger.error(`Failed to initiate PayPal payment: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Process a PayPal webhook event
   * Not yet implemented - would be similar to Stripe webhook handling
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handlePaypalWebhook(_payload: Record<string, unknown>): Promise<{ received: boolean; type: string }> {
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
  async processRefund(data: CreateRefundDto, processedByUserId: string, options: ProcessRefundOptions = {}): Promise<RefundResult> {
    const refundRequestId = `refund-${data.paymentId}-${Date.now()}`;

    let pendingRefund: PaymentRefund | null = null;
    let paymentForProcessor: RefundablePayment | null = null;
    let processorRefundSubmitted = false;

    try {
      if (
        data.resultingRegistrationStatus === RegistrationStatus.CANCELLED &&
        !options.allowRegistrationCancellation
      ) {
        throw new BadRequestException('Use the registration cancellation flow to cancel a registration');
      }

      if (
        data.resultingRegistrationStatus &&
        isApplicationStatus(data.resultingRegistrationStatus)
      ) {
        throw new BadRequestException(
          'Cannot set an application-phase registration status from the refund flow',
        );
      }

      const existingPayment = await this.prisma.payment.findUnique({
        where: { id: data.paymentId },
        include: {
          registration: true,
          refunds: true,
        },
      });

      if (!existingPayment) {
        throw new NotFoundException(`Payment with ID ${data.paymentId} not found`);
      }

      await this.reconcilePendingProcessorRefunds(existingPayment, processedByUserId);

      const pendingRefundData = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: data.paymentId },
          include: {
            registration: true,
            refunds: true,
          },
        });

        if (!payment) {
          throw new NotFoundException(`Payment with ID ${data.paymentId} not found`);
        }

        if (data.resultingRegistrationStatus && !payment.registration) {
          throw new BadRequestException(
            'Cannot change registration status for a payment without a linked registration',
          );
        }

        if (
          data.resultingRegistrationStatus &&
          payment.registration?.status === RegistrationStatus.CANCELLED &&
          data.resultingRegistrationStatus !== RegistrationStatus.CANCELLED
        ) {
          throw new BadRequestException('Cannot edit a cancelled registration');
        }

        if (!this.isRefundableStatus(payment.status)) {
          throw new BadRequestException(`Cannot refund payment with status ${payment.status}`);
        }

        if (payment.provider === PaymentProvider.PAYPAL) {
          throw new BadRequestException('Automated PayPal refunds are not currently supported');
        }

        const paymentAmountCents = this.toCents(payment.amount);
        const alreadyRefundedCents = (payment.refunds ?? [])
          .filter((refund) => refund.status === PaymentRefundStatus.SUCCEEDED || refund.status === PaymentRefundStatus.PENDING)
          .reduce((sum, refund) => sum + refund.amountCents, 0);
        const remainingCents = paymentAmountCents - alreadyRefundedCents;

        if (remainingCents <= 0) {
          throw new BadRequestException('Payment has no remaining refundable balance');
        }

        let refundAmountCents = data.amount ? this.toCents(data.amount) : remainingCents;

        if (!data.amount && data.percentageOfOriginal) {
          refundAmountCents = Math.round(paymentAmountCents * (data.percentageOfOriginal / 100));
        }

        if (refundAmountCents <= 0) {
          throw new BadRequestException('Refund amount must be greater than zero');
        }

        if (refundAmountCents > remainingCents) {
          throw new BadRequestException('Refund amount exceeds remaining refundable balance');
        }

        this.validateSupportedAmountCents(refundAmountCents, 'Refund');

        const processorRefund = this.isProcessorRefundProvider(payment.provider);
        const refund = await tx.paymentRefund.create({
          data: {
            paymentId: payment.id,
            amountCents: refundAmountCents,
            currency: payment.currency,
            status: processorRefund ? PaymentRefundStatus.PENDING : PaymentRefundStatus.SUCCEEDED,
            processorRefund,
            reason: data.reason,
            resultingRegistrationStatus: data.resultingRegistrationStatus,
            processedByUserId,
          },
        });

        if (processorRefund) {
          return { refund, payment, finalization: undefined };
        }

        const previousRefundedCents = this.getSucceededRefundCents(payment.refunds);
        const refundedCents = previousRefundedCents + refund.amountCents;
        const nextStatus = this.getPaymentStatusFromRefunds(
          paymentAmountCents,
          refundedCents,
        );
        const appliedRegistrationStatus = this.getAppliedRegistrationStatus(
          payment.registration,
          refund.resultingRegistrationStatus,
        );

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: nextStatus },
        });

        if (payment.registration && appliedRegistrationStatus) {
          await tx.registration.update({
            where: { id: payment.registration.id },
            data: { status: appliedRegistrationStatus },
          });
        }

        return {
          refund,
          payment,
          finalization: {
            refund,
            payment,
            nextStatus,
            previousRefundedCents,
            appliedRegistrationStatus,
          },
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      pendingRefund = pendingRefundData.refund;
      paymentForProcessor = pendingRefundData.payment;
      let providerRefund: ProviderRefund = { id: pendingRefund.id };

      if (paymentForProcessor.provider === PaymentProvider.STRIPE) {
        if (!paymentForProcessor.providerRefId || paymentForProcessor.providerRefId.startsWith('manual')) {
          throw new BadRequestException('Payment is not eligible for automated Stripe refund');
        }

        try {
          providerRefund = await this.stripeService.createRefund(
            paymentForProcessor.providerRefId,
            pendingRefund.amountCents,
            data.reason,
            pendingRefund.id,
            {
              refundId: pendingRefund.id,
              paymentId: paymentForProcessor.id,
            },
          );
          processorRefundSubmitted = true;
        } catch (error: unknown) {
          if (error instanceof StripeRefundError && error.possiblySubmitted) {
            this.logger.warn(
              `Stripe refund submission outcome is ambiguous for refund ${pendingRefund.id}; leaving it PENDING for reconciliation: ${error.message}`,
            );
            return {
              paymentId: paymentForProcessor.id,
              refundAmount: this.toDollars(pendingRefund.amountCents),
              providerRefundId: pendingRefund.id,
              success: false,
              refundStatus: PaymentRefundStatus.PENDING,
            };
          }
          throw error;
        }

        let finalization: RefundFinalization | null;
        try {
          finalization = await this.finalizeProcessorRefund(pendingRefund, providerRefund);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Stripe refund ${providerRefund.id} was submitted but local finalization failed: ${errorMessage}`,
            error instanceof Error ? error.stack : undefined,
          );
          return {
            paymentId: paymentForProcessor.id,
            refundAmount: this.toDollars(pendingRefund.amountCents),
            providerRefundId: providerRefund.id,
            success: false,
            refundStatus: PaymentRefundStatus.PENDING,
          };
        }

        if (finalization === null) {
          this.logger.warn(
            `Refund state for ${pendingRefund.id} was already applied`,
          );
          return {
            paymentId: paymentForProcessor.id,
            refundAmount: this.toDollars(pendingRefund.amountCents),
            providerRefundId: providerRefund.id,
            success: false,
            refundStatus: PaymentRefundStatus.PENDING,
          };
        }

        await this.createRefundAudit(finalization, refundRequestId);
        return {
          paymentId: finalization.payment.id,
          refundAmount: this.toDollars(finalization.refund.amountCents),
          providerRefundId: providerRefund.id,
          success: finalization.refund.status === PaymentRefundStatus.SUCCEEDED,
          refundStatus: finalization.refund.status,
        };
      }

      const finalization = pendingRefundData.finalization;
      if (!finalization) {
        throw new BadRequestException('Refund provider requires processor finalization');
      }

      await this.createRefundAudit(finalization, refundRequestId);

      return {
        paymentId: finalization.payment.id,
        refundAmount: this.toDollars(pendingRefund.amountCents),
        providerRefundId: providerRefund.id,
        success: pendingRefund.status === PaymentRefundStatus.SUCCEEDED,
        refundStatus: pendingRefund.status,
      };
    } catch (error: unknown) {
      if (pendingRefund?.status === PaymentRefundStatus.PENDING && !processorRefundSubmitted) {
        await this.prisma.paymentRefund.update({
          where: { id: pendingRefund.id },
          data: { status: PaymentRefundStatus.FAILED },
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process refund: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
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
      const payment = await this.prisma.payment.findFirst({
        where: { providerRefId: sessionId },
        include: { registration: true },
      }) as PaymentWithRelations;
      
      if (!payment) {
        throw new NotFoundException(`Payment not found for Stripe session ${sessionId}`);
      }

      this.logger.log(`Found payment ${payment.id} for session ${sessionId}, registration: ${payment.registration?.id || 'none'}, registration status: ${payment.registration?.status || 'none'}`);

      // Get the actual session status from Stripe
      const stripeSession = await this.stripeService.getCheckoutSession(sessionId);
      
      this.logger.log(`Stripe session ${sessionId} status: ${stripeSession.status}, payment_status: ${stripeSession.payment_status}`);
      
      // Determine the payment status based on Stripe session
      let updatedPaymentStatus = payment.status;
      let updatedRegistrationStatus = payment.registration?.status;
      
      if (stripeSession.payment_status === 'paid') {
        // Payment was successful - mark payment and registration as complete
        const shouldCompletePayment = this.shouldCompletePaymentFromPaidSession(payment.status);
        updatedPaymentStatus = shouldCompletePayment ? PaymentStatus.COMPLETED : payment.status;
        
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
          const isCancelled = payment.registration.status === 'CANCELLED';
          const isWaitlisted = payment.registration.status === 'WAITLISTED';
          updatedRegistrationStatus = isWaitlisted ? 'WAITLISTED' : 'CONFIRMED';
          const targetStatus = updatedRegistrationStatus;

          if (isCancelled) {
            if (shouldCompletePayment) {
              await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: updatedPaymentStatus },
              });
            }

            return {
              sessionId,
              paymentStatus: updatedPaymentStatus,
              registrationStatus: RegistrationStatus.CANCELLED,
              registrationId: payment.registration.id,
              paymentId: payment.id,
            };
          }

          // Update path fires when ANY of (a) payment not yet COMPLETED,
          // (b) registration not at its target status (CONFIRMED unless
          // WAITLISTED, in which case it stays WAITLISTED), (c) registration
          // still flagged paymentDeferred=true. The third clause matters
          // for deferred registrations: a deferred row starts as CONFIRMED
          // + paymentDeferred=true, so without this clause a retry after
          // payment would skip the update and leave paymentDeferred true.
          if (
            shouldCompletePayment ||
            payment.registration.status !== targetStatus ||
            payment.registration.paymentDeferred
          ) {
            try {
              this.logger.log(`Updating payment ${payment.id} to COMPLETED and registration ${payment.registration.id} to ${targetStatus} (paymentDeferred cleared)`);
              
              try {
                // Use transaction to ensure atomicity between payment and registration updates
                const transactionResults = await this.prisma.$transaction([
                  this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: updatedPaymentStatus },
                  }),
                  this.prisma.registration.update({
                    where: { id: payment.registration.id },
                    data: { status: targetStatus, paymentDeferred: false },
                  }),
                ]);
                
                this.logger.log(`Successfully updated payment and registration statuses`);
                this.logger.debug(`Transaction results: ${JSON.stringify({
                  payment: transactionResults[0].id,
                  registration: transactionResults[1].id
                })}`);

                // Send registration confirmation email with the updated
                // status — but skip it for a deferred → paid transition,
                // because the participant already received a confirmation
                // email at registration creation time (with a "payment
                // deferred" notice). Sending it again would duplicate.
                const wasDeferred = payment.registration.paymentDeferred === true;
                if (!wasDeferred) {
                  this.sendRegistrationConfirmationEmailAfterPayment(payment.registration.id)
                    .catch(emailError => {
                      this.logger.warn(`Failed to send registration confirmation email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
                    });
                }
              } catch (transactionError) {
                // If the transaction fails, at least try to update the payment status
                // This ensures we record the successful Stripe payment even if registration update fails
                this.logger.warn(`Transaction failed, falling back to payment-only update: ${transactionError instanceof Error ? transactionError.message : 'Unknown error'}`);
                
                if (shouldCompletePayment) {
                  await this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { 
                      status: updatedPaymentStatus
                    },
                  });
                  this.logger.log(`Updated payment ${payment.id} to COMPLETED (registration update failed: ${transactionError instanceof Error ? transactionError.message : 'Unknown error'})`);
                }
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(`Failed to update statuses: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
              throw new BadRequestException(`Failed to update payment or registration status: ${errorMessage}`);
            }
          } else {
            this.logger.log(`Both payment and registration already have correct statuses, no update needed`);
          }
        } else {
          // No registration linked, just update the payment if needed
          if (shouldCompletePayment) {
            await this.update(payment.id, {
              status: PaymentStatus.COMPLETED,
            });
            this.logger.log(`Updated payment ${payment.id} to COMPLETED (no registration)`);
          } else {
            this.logger.log(`Payment ${payment.id} already marked as COMPLETED (no registration)`);
          }
        }
      } else if (stripeSession.payment_status === 'unpaid' && payment.status === PaymentStatus.PENDING) {
        // Payment is still pending or failed
        if (stripeSession.status === 'expired') {
          this.logger.log(`Updating payment ${payment.id} status to FAILED based on expired Stripe session`);
          
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
      this.logger.error(`Failed to verify Stripe session: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to verify Stripe session');
    }
  }

  /**
   * Send registration confirmation email after payment completion
   * @param registrationId - The registration ID
   */
  private async sendRegistrationConfirmationEmailAfterPayment(registrationId: string): Promise<void> {
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
      const jobs = registration.jobs?.map((regJob) => ({
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
      const userName = registration.user.firstName && registration.user.lastName 
        ? `${registration.user.firstName} ${registration.user.lastName}` 
        : undefined;

      await this.notificationsService.sendRegistrationConfirmationEmail(
        registration.user.email,
        registrationDetails,
        registration.userId,
        userName,
        registration.user.playaName || undefined
      );

      this.logger.log(`Registration confirmation email sent to ${registration.user.email} with status ${registration.status}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Error sending registration confirmation email after payment: ${err.message}`, err.stack);
      // Don't throw - email failures should not block payment processing
    }
  }
}