import { Controller, Post, Body, Get, Param, Query, UseGuards, ParseUUIDPipe, Put, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService, StripeService, PaypalService } from '../services';
import { CreatePaymentDto, CreateStripePaymentDto, CreatePaypalPaymentDto, CreateRefundDto, RecordManualPaymentDto, UpdatePaymentDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PaymentStatus, UserRole, User } from '@prisma/client';

// Interface for authenticated request with user
interface AuthenticatedRequest extends Request {
  user: Omit<User, 'password'>;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    private readonly paypalService: PaypalService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new payment record' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payments (admin/staff only), with optional filters' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Staff access required' })
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.findAll(
      skip ? parseInt(skip, 10) : undefined,
      take ? parseInt(take, 10) : undefined,
      userId,
      status,
    );
  }

  @Get('my-payments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s payments only' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiResponse({ status: 200, description: 'User payments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findMyPayments(
    @Request() req: AuthenticatedRequest,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    const userId = req.user.id;
    return this.paymentsService.findAll(
      skip ? parseInt(skip, 10) : undefined,
      take ? parseInt(take, 10) : undefined,
      userId, // Force filter to current user
      status,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID (own payments only unless admin/staff)' })
  @ApiParam({ name: 'id', required: true, description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only access own payments' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: AuthenticatedRequest) {
    return this.paymentsService.findOneWithOwnershipCheck(id, req.user.id, req.user.role);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update payment' })
  @ApiParam({ name: 'id', required: true, description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(id, updatePaymentDto);
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a manual payment (e.g., cash, check)' })
  @ApiResponse({ status: 201, description: 'Manual payment recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async recordManualPayment(@Body() recordManualPaymentDto: RecordManualPaymentDto) {
    return this.paymentsService.recordManualPayment(recordManualPaymentDto);
  }

  @Post('stripe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a Stripe payment' })
  @ApiResponse({ status: 201, description: 'Stripe payment initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async initiateStripePayment(@Body() createStripePaymentDto: CreateStripePaymentDto) {
    return this.paymentsService.initiateStripePayment(createStripePaymentDto);
  }

  @Post('paypal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a PayPal payment' })
  @ApiResponse({ status: 201, description: 'PayPal payment initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async initiatePaypalPayment(@Body() createPaypalPaymentDto: CreatePaypalPaymentDto) {
    return this.paymentsService.initiatePaypalPayment(createPaypalPaymentDto);
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process a refund' })
  @ApiResponse({ status: 201, description: 'Refund processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or cannot refund this payment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async processRefund(@Body() createRefundDto: CreateRefundDto) {
    return this.paymentsService.processRefund(createRefundDto);
  }

  @Post('link/:paymentId/registration/:registrationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link a payment to a registration' })
  @ApiParam({ name: 'paymentId', required: true, description: 'Payment ID' })
  @ApiParam({ name: 'registrationId', required: true, description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Payment linked to registration successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or registration conflict' })
  @ApiResponse({ status: 404, description: 'Payment or registration not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async linkToRegistration(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
  ) {
    return this.paymentsService.linkToRegistration(paymentId, registrationId);
  }

  @Post('webhook/paypal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle PayPal webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async handlePaypalWebhook(@Body() payload: Record<string, unknown>) {
    return this.paymentsService.handlePaypalWebhook(payload);
  }

  @Get('stripe/session/:sessionId/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Stripe checkout session and get payment status' })
  @ApiParam({ name: 'sessionId', required: true, description: 'Stripe checkout session ID' })
  @ApiResponse({ status: 200, description: 'Session verification result' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyStripeSession(@Param('sessionId') sessionId: string) {
    return this.paymentsService.verifyStripeSession(sessionId);
  }
}