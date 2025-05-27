import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../../services/payments.service';
import { StripeService } from '../../services/stripe.service';
import { PaypalService } from '../../services/paypal.service';
import { UserRole, PaymentStatus, PaymentProvider } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('PaymentsController Security', () => {
  let controller: PaymentsController;
  let paymentsService: PaymentsService;

  const mockPayment = {
    id: 'payment-123',
    userId: 'user-123',
    amount: 100,
    currency: 'USD',
    status: PaymentStatus.COMPLETED,
    provider: PaymentProvider.STRIPE,
    providerRefId: 'stripe-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    registrationId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            findAll: jest.fn(),
            findOneWithOwnershipCheck: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {},
        },
        {
          provide: PaypalService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  describe('findAll (admin/staff only)', () => {
    it('should allow admin to get all payments', async () => {
      const mockResult = { payments: [mockPayment], total: 1 };
      jest.spyOn(paymentsService, 'findAll').mockResolvedValue(mockResult);

      const result = await controller.findAll();

      expect(result).toEqual(mockResult);
      expect(paymentsService.findAll).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
    });

    it('should allow filtering by userId for reports', async () => {
      const mockResult = { payments: [mockPayment], total: 1 };
      jest.spyOn(paymentsService, 'findAll').mockResolvedValue(mockResult);

      const result = await controller.findAll('0', '10', 'user-123', undefined);

      expect(result).toEqual(mockResult);
      expect(paymentsService.findAll).toHaveBeenCalledWith(0, 10, 'user-123', undefined);
    });
  });

  describe('findMyPayments (user-specific)', () => {
    it('should only return payments for the authenticated user', async () => {
      const mockResult = { payments: [mockPayment], total: 1 };
      const mockRequest = { 
        user: { id: 'user-123', role: UserRole.PARTICIPANT } 
      } as unknown as Parameters<typeof controller.findMyPayments>[0];
      
      jest.spyOn(paymentsService, 'findAll').mockResolvedValue(mockResult);

      const result = await controller.findMyPayments(mockRequest);

      expect(result).toEqual(mockResult);
      expect(paymentsService.findAll).toHaveBeenCalledWith(undefined, undefined, 'user-123', undefined);
    });
  });

  describe('findOne (with ownership check)', () => {
    it('should allow admin to access any payment', async () => {
      const mockRequest = { 
        user: { id: 'admin-123', role: UserRole.ADMIN } 
      } as unknown as Parameters<typeof controller.findOne>[1];
      
      jest.spyOn(paymentsService, 'findOneWithOwnershipCheck').mockResolvedValue(mockPayment);

      const result = await controller.findOne('payment-123', mockRequest);

      expect(result).toEqual(mockPayment);
      expect(paymentsService.findOneWithOwnershipCheck).toHaveBeenCalledWith('payment-123', 'admin-123', UserRole.ADMIN);
    });

    it('should allow staff to access any payment', async () => {
      const mockRequest = { 
        user: { id: 'staff-123', role: UserRole.STAFF } 
      } as unknown as Parameters<typeof controller.findOne>[1];
      
      jest.spyOn(paymentsService, 'findOneWithOwnershipCheck').mockResolvedValue(mockPayment);

      const result = await controller.findOne('payment-123', mockRequest);

      expect(result).toEqual(mockPayment);
      expect(paymentsService.findOneWithOwnershipCheck).toHaveBeenCalledWith('payment-123', 'staff-123', UserRole.STAFF);
    });

    it('should only allow users to access their own payments', async () => {
      const mockRequest = { 
        user: { id: 'user-123', role: UserRole.PARTICIPANT } 
      } as unknown as Parameters<typeof controller.findOne>[1];
      
      jest.spyOn(paymentsService, 'findOneWithOwnershipCheck').mockResolvedValue(mockPayment);

      const result = await controller.findOne('payment-123', mockRequest);

      expect(result).toEqual(mockPayment);
      expect(paymentsService.findOneWithOwnershipCheck).toHaveBeenCalledWith('payment-123', 'user-123', UserRole.PARTICIPANT);
    });

    it('should throw NotFoundException when user tries to access another user\'s payment', async () => {
      const mockRequest = { 
        user: { id: 'user-456', role: UserRole.PARTICIPANT } 
      } as unknown as Parameters<typeof controller.findOne>[1];
      
      jest.spyOn(paymentsService, 'findOneWithOwnershipCheck').mockRejectedValue(
        new NotFoundException('Payment with ID payment-123 not found')
      );

      await expect(controller.findOne('payment-123', mockRequest)).rejects.toThrow(NotFoundException);
      expect(paymentsService.findOneWithOwnershipCheck).toHaveBeenCalledWith('payment-123', 'user-456', UserRole.PARTICIPANT);
    });
  });
});
