import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto, CreateRefundDto, RecordManualPaymentDto, CreateStripePaymentDto, CreatePaypalPaymentDto } from '../dto';
import { Payment, PaymentProvider, PaymentStatus, Registration, UserRole } from '@prisma/client';
import { StripeService } from './stripe.service';
import { PaypalService } from './paypal.service';

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
        throw new NotFoundException(`Registration with ID ${createPaymentDto.registrationId} not found`);
      }
      
      if (registration.userId !== createPaymentDto.userId) {
        throw new BadRequestException('Registration does not belong to the specified user');
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
   * @returns Paginated list of payments
   */
  async findAll(skip = 0, take = 10, userId?: string, status?: PaymentStatus): Promise<{ payments: Payment[]; total: number }> {
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);
    
    return { payments, total };
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
  async recordManualPayment(data: RecordManualPaymentDto): Promise<Payment> {
    // Create payment record with appropriate status
    const payment = await this.create({
      amount: data.amount,
      currency: data.currency,
      provider: PaymentProvider.STRIPE, // Use Stripe as default for manual
      userId: data.userId,
      registrationId: data.registrationId,
      providerRefId: data.reference ? `manual:${data.reference}` : 'manual',
    });
    
    // Update status immediately (since it's a manual payment)
    const updateDto: UpdatePaymentDto = {
      status: data.status || PaymentStatus.COMPLETED,
    };
    
    // Note: Previous code stored a reference as notes, but notes field is not present in schema
    // if (data.reference) {
    //   updateDto.notes = data.reference;
    // }
    
    return this.update(payment.id, updateDto);
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
  async processRefund(data: CreateRefundDto): Promise<RefundResult> {
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
        
        // For Stripe, amount needs to be in cents
        const refundAmountCents = Math.round(refundAmount * 100);
        
        providerRefund = await this.stripeService.createRefund(
          payment.providerRefId,
          refundAmountCents,
          data.reason,
        );
      } else if (payment.provider === PaymentProvider.PAYPAL) {
        if (!payment.providerRefId) {
          throw new BadRequestException('Payment has no provider reference ID');
        }
        
        // For PayPal, we need to use the capture ID which might be different from order ID
        // Usually we'd store the capture ID in providerRefId after payment completion
        providerRefund = await this.paypalService.createRefund(
          payment.providerRefId,
          refundAmount,
          data.reason,
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
        updatedPaymentStatus = PaymentStatus.COMPLETED;
        
        if (payment.registration) {
          updatedRegistrationStatus = 'CONFIRMED';

          // If either the payment or registration status needs updating
          if (payment.status !== PaymentStatus.COMPLETED || payment.registration.status !== 'CONFIRMED') {
            try {
              this.logger.log(`Updating payment ${payment.id} to COMPLETED and registration ${payment.registration.id} to CONFIRMED`);
              
              try {
                // Use transaction to ensure atomicity between payment and registration updates
                const transactionResults = await this.prisma.$transaction([
                  this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: PaymentStatus.COMPLETED },
                  }),
                  this.prisma.registration.update({
                    where: { id: payment.registration.id },
                    data: { status: 'CONFIRMED' },
                  }),
                ]);
                
                this.logger.log(`Successfully updated payment and registration statuses`);
                this.logger.debug(`Transaction results: ${JSON.stringify({
                  payment: transactionResults[0].id,
                  registration: transactionResults[1].id
                })}`);
              } catch (transactionError) {
                // If the transaction fails, at least try to update the payment status
                // This ensures we record the successful Stripe payment even if registration update fails
                this.logger.warn(`Transaction failed, falling back to payment-only update: ${transactionError instanceof Error ? transactionError.message : 'Unknown error'}`);
                
                if (payment.status !== PaymentStatus.COMPLETED) {
                  await this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { 
                      status: PaymentStatus.COMPLETED
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
          if (payment.status !== PaymentStatus.COMPLETED) {
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
}