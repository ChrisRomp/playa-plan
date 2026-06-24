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

// Create an extended Payment type that includes registration relationship
type PaymentWithRelations = Payment & {
  registration?: Registration | null;
  refunds?: PaymentRefund[];
};

type RefundablePayment = Payment & {
  registration: Registration | null;
  refunds: PaymentRefund[];
};

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

  private toDollars(amountCents: number): number {
    return amountCents / 100;
  }

  private getSucceededRefundCents(refunds: PaymentRefund[] = []): number {
    return refunds
      .filter((refund) => refund.status === PaymentRefundStatus.SUCCEEDED)
      .reduce((sum, refund) => sum + refund.amountCents, 0);
  }

  private getReservedRefundCents(refunds: PaymentRefund[] = []): number {
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

  private getPaymentOverview<T extends Payment & { refunds?: PaymentRefund[] }>(payment: T): T & PaymentOverview {
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

  private async reconcilePendingProcessorRefunds(payment: RefundablePayment): Promise<void> {
    const pendingRefunds = payment.refunds.filter(
      (refund) => refund.processorRefund && refund.status === PaymentRefundStatus.PENDING,
    );

    if (pendingRefunds.length === 0) {
      return;
    }

    if (payment.provider !== PaymentProvider.STRIPE || !payment.providerRefId) {
      return;
    }

    let reconciled = false;
    for (const refund of pendingRefunds) {
      const providerRefund = refund.providerRefundId
        ? await this.stripeService.retrieveRefund(refund.providerRefundId)
        : await this.stripeService.createRefund(
          payment.providerRefId,
          refund.amountCents,
          refund.reason ?? undefined,
          refund.id,
        );
      const refundStatus = this.getRefundStatusFromProviderStatus(providerRefund.status);

      await this.prisma.paymentRefund.update({
        where: { id: refund.id },
        data: {
          status: refundStatus,
          providerRefundId: providerRefund.id,
        },
      });
      reconciled = true;
    }

    if (!reconciled) {
      return;
    }

    const refreshedPayment = await this.prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        registration: true,
        refunds: true,
      },
    });

    if (!refreshedPayment) {
      return;
    }

    const refundedCents = this.getSucceededRefundCents(refreshedPayment.refunds);
    const nextStatus = this.getPaymentStatusFromRefunds(this.toCents(refreshedPayment.amount), refundedCents);
    const transactionUpdates: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.payment.update({
        where: { id: refreshedPayment.id },
        data: { status: nextStatus },
      }),
    ];

    for (const refund of refreshedPayment.refunds) {
      if (
        refund.status === PaymentRefundStatus.SUCCEEDED &&
        refund.resultingRegistrationStatus &&
        refreshedPayment.registration
      ) {
        transactionUpdates.push(
          this.prisma.registration.update({
            where: { id: refreshedPayment.registration.id },
            data: { status: refund.resultingRegistrationStatus },
          }),
        );
      }
    }

    await this.prisma.$transaction(transactionUpdates);
  }

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
        status: PaymentStatus.PENDING,
        provider: createPaymentDto.provider,
        providerRefId: createPaymentDto.providerRefId,
        externalPaymentMethod: createPaymentDto.externalPaymentMethod,
        externalPaymentReference: createPaymentDto.externalPaymentReference,
        user: { connect: { id: createPaymentDto.userId } },
        ...(createPaymentDto.recordedByUserId && {
          recordedBy: { connect: { id: createPaymentDto.recordedByUserId } },
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
  async findOneWithOwnershipCheck(id: string, userId: string, userRole: UserRole): Promise<PaymentWithRelations> {
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
   * Record a manual payment (e.g., cash, check)
   * @param data - Manual payment data
   * @returns The created payment
   */
  async recordManualPayment(data: RecordManualPaymentDto, recordedByUserId: string): Promise<Payment> {
    // Create payment record with appropriate status
    const payment = await this.create({
      amount: data.amount,
      currency: data.currency,
      provider: PaymentProvider.MANUAL,
      userId: data.userId,
      registrationId: data.registrationId,
      externalPaymentMethod: data.externalPaymentMethod,
      externalPaymentReference: data.reference,
      recordedByUserId,
    });
    
    // Update status immediately (since it's a manual payment)
    const updateDto: UpdatePaymentDto = {
      status: data.status || PaymentStatus.COMPLETED,
    };
    
    const updatedPayment = await this.update(payment.id, updateDto);

    // When a manual payment is recorded as COMPLETED against a registration,
    // mark the registration paid: status CONFIRMED, paymentDeferred=false.
    // This also closes out any deferred registrations that an admin records
    // a manual payment for.
    if (
      data.registrationId &&
      (data.status ?? PaymentStatus.COMPLETED) === PaymentStatus.COMPLETED
    ) {
      try {
        await this.markRegistrationPaid(data.registrationId);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Failed to mark registration ${data.registrationId} paid after manual payment ${payment.id}: ${errorMessage}`,
        );
      }
    }

    await this.adminAuditService.createAuditRecord({
      adminUserId: recordedByUserId,
      actionType: AdminAuditActionType.PAYMENT_RECORD,
      targetRecordType: AdminAuditTargetType.PAYMENT,
      targetRecordId: payment.id,
      newValues: {
        amount: data.amount,
        currency: data.currency ?? 'USD',
        provider: PaymentProvider.MANUAL,
        status: data.status ?? PaymentStatus.COMPLETED,
        externalPaymentMethod: data.externalPaymentMethod,
        externalPaymentReference: data.reference,
        userId: data.userId,
        registrationId: data.registrationId,
      },
      reason: data.reference,
      throwOnError: false,
    });

    return updatedPayment;
  }

  /**
   * Mark a registration as paid: clear `paymentDeferred` and set status
   * to CONFIRMED — UNLESS the registration is currently WAITLISTED, in
   * which case status stays WAITLISTED (capacity beats payment). Payment
   * does not buy a slot the user can't have. The WAITLISTED case is
   * unreachable for participants through normal UI but possible via
   * direct API call or a TOCTOU race against capacity; mirrors the same
   * guard in `verifyStripeSession`.
   *
   * Idempotent — safe to call multiple times. Called from every
   * successful payment-completion path (today: Stripe verification path
   * and `recordManualPayment`; any future payment provider should call
   * this too) so the registration is always brought to a consistent
   * paid state when a payment lands.
   */
  private async markRegistrationPaid(registrationId: string): Promise<void> {
    const current = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { status: true },
    });
    if (!current) return;
    const targetStatus = current.status === 'WAITLISTED' ? 'WAITLISTED' : 'CONFIRMED';
    await this.prisma.registration.update({
      where: { id: registrationId },
      data: { status: targetStatus, paymentDeferred: false },
    });
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

      await this.reconcilePendingProcessorRefunds(existingPayment);

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

        const refund = await tx.paymentRefund.create({
          data: {
            paymentId: payment.id,
            amountCents: refundAmountCents,
            currency: payment.currency,
            status: this.isProcessorRefundProvider(payment.provider) ? PaymentRefundStatus.PENDING : PaymentRefundStatus.SUCCEEDED,
            processorRefund: this.isProcessorRefundProvider(payment.provider),
            reason: data.reason,
            resultingRegistrationStatus: data.resultingRegistrationStatus,
            processedByUserId,
          },
        });

        return { refund, payment };
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
          );
          processorRefundSubmitted = true;
        } catch (error: unknown) {
          processorRefundSubmitted = error instanceof StripeRefundError && error.refundRequestAttempted;
          throw error;
        }

        const providerRefundStatus = this.getRefundStatusFromProviderStatus(providerRefund.status);
        await this.prisma.paymentRefund.update({
          where: { id: pendingRefund.id },
          data: {
            status: providerRefundStatus,
            providerRefundId: providerRefund.id,
          },
        });
        pendingRefund = {
          ...pendingRefund,
          status: providerRefundStatus,
          providerRefundId: providerRefund.id,
        };
      }

      const payment = await this.prisma.payment.findUnique({
        where: { id: data.paymentId },
        include: {
          registration: true,
          refunds: true,
        },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${data.paymentId} not found`);
      }

      const refundedCents = this.getSucceededRefundCents(payment.refunds);
      const nextStatus = this.getPaymentStatusFromRefunds(this.toCents(payment.amount), refundedCents);
      const previousRefundedCents = pendingRefund.status === PaymentRefundStatus.SUCCEEDED
        ? Math.max(refundedCents - pendingRefund.amountCents, 0)
        : refundedCents;

      const transactionUpdates: Prisma.PrismaPromise<unknown>[] = [
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: nextStatus },
        }),
      ];
      const appliedRegistrationStatus = pendingRefund.status === PaymentRefundStatus.SUCCEEDED
        ? data.resultingRegistrationStatus
        : undefined;

      if (
        payment.registration &&
        appliedRegistrationStatus
      ) {
        transactionUpdates.push(
          this.prisma.registration.update({
            where: { id: payment.registration.id },
            data: { status: appliedRegistrationStatus },
          }),
        );
      }

      await this.prisma.$transaction(transactionUpdates);

      await this.adminAuditService.createAuditRecord({
        adminUserId: processedByUserId,
        actionType: AdminAuditActionType.PAYMENT_REFUND,
        targetRecordType: AdminAuditTargetType.PAYMENT,
        targetRecordId: payment.id,
        oldValues: {
          status: payment.status,
          refundedAmount: this.toDollars(previousRefundedCents),
        },
        newValues: {
          status: nextStatus,
          refundId: pendingRefund.id,
          refundAmount: this.toDollars(pendingRefund.amountCents),
          refundAmountCents: pendingRefund.amountCents,
          providerRefundId: providerRefund.id,
          processorRefund: pendingRefund.processorRefund,
          resultingRegistrationStatus: appliedRegistrationStatus,
        },
        reason: data.reason,
        transactionId: refundRequestId,
        throwOnError: false,
      });

      return {
        paymentId: payment.id,
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
              status: updatedPaymentStatus,
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