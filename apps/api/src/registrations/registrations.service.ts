import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRegistrationDto, UpdateRegistrationDto } from './dto';
import { Registration, RegistrationStatus } from '@prisma/client';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new registration
   * @param createRegistrationDto - The data to create the registration
   * @returns The created registration
   */
  async create(createRegistrationDto: CreateRegistrationDto): Promise<Registration> {
    // Check if shift exists and has capacity
    const shift = await this.prisma.shift.findUnique({
      where: { id: createRegistrationDto.shiftId },
      include: { registrations: true },
    });

    if (!shift) {
      throw new NotFoundException(`Shift with ID ${createRegistrationDto.shiftId} not found`);
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createRegistrationDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${createRegistrationDto.userId} not found`);
    }

    // Check if user already registered for this shift
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        userId: createRegistrationDto.userId,
        shiftId: createRegistrationDto.shiftId,
        status: { notIn: [RegistrationStatus.CANCELLED] },
      },
    });

    if (existingRegistration) {
      throw new BadRequestException('User already registered for this shift');
    }

    // Determine registration status based on capacity
    const status = shift.registrations.filter(
      r => r.status !== RegistrationStatus.CANCELLED
    ).length >= shift.maxRegistrations
      ? RegistrationStatus.WAITLISTED
      : RegistrationStatus.PENDING;

    // Create registration data object
    const data: {
      status: RegistrationStatus;
      user: { connect: { id: string } };
      shift: { connect: { id: string } };
      payment?: { connect: { id: string } };
    } = {
      status,
      user: { connect: { id: createRegistrationDto.userId } },
      shift: { connect: { id: createRegistrationDto.shiftId } },
    };

    // Add payment if provided
    if (createRegistrationDto.paymentId) {
      // Check if payment exists
      const payment = await this.prisma.payment.findUnique({
        where: { id: createRegistrationDto.paymentId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${createRegistrationDto.paymentId} not found`);
      }

      data.payment = { connect: { id: createRegistrationDto.paymentId } };
    }

    return this.prisma.registration.create({
      data,
      include: {
        user: true,
        shift: {
          include: {
            job: true,
            camp: true,
          },
        },
        payment: true,
      },
    });
  }

  /**
   * Get all registrations
   * @returns All registrations
   */
  async findAll(): Promise<Registration[]> {
    return this.prisma.registration.findMany({
      include: {
        user: true,
        shift: {
          include: {
            job: true,
            camp: true,
          },
        },
        payment: true,
      },
    });
  }

  /**
   * Get registrations for a specific user
   * @param userId - The ID of the user
   * @returns The user's registrations
   */
  async findByUser(userId: string): Promise<Registration[]> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.registration.findMany({
      where: { userId },
      include: {
        shift: {
          include: {
            job: true,
            camp: true,
          },
        },
        payment: true,
      },
    });
  }

  /**
   * Get registrations for a specific shift
   * @param shiftId - The ID of the shift
   * @returns The shift's registrations
   */
  async findByShift(shiftId: string): Promise<Registration[]> {
    // Check if shift exists
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    return this.prisma.registration.findMany({
      where: { shiftId },
      include: {
        user: true,
        payment: true,
      },
    });
  }

  /**
   * Get a registration by ID
   * @param id - The ID of the registration to find
   * @returns The registration, if found
   * @throws NotFoundException if not found
   */
  async findOne(id: string): Promise<Registration> {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        user: true,
        shift: {
          include: {
            job: true,
            camp: true,
          },
        },
        payment: true,
      },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    return registration;
  }

  /**
   * Update a registration
   * @param id - The ID of the registration to update
   * @param updateRegistrationDto - The data to update the registration with
   * @returns The updated registration
   * @throws NotFoundException if not found
   */
  async update(id: string, updateRegistrationDto: UpdateRegistrationDto): Promise<Registration> {
    // Check if registration exists
    await this.findOne(id);

    const data: {
      status?: RegistrationStatus;
      shift?: { connect: { id: string } };
      payment?: { connect: { id: string } };
      [key: string]: any;
    } = { ...updateRegistrationDto };
    
    // Handle relations
    if (updateRegistrationDto.shiftId) {
      // Check if shift exists
      const shift = await this.prisma.shift.findUnique({
        where: { id: updateRegistrationDto.shiftId },
      });

      if (!shift) {
        throw new NotFoundException(`Shift with ID ${updateRegistrationDto.shiftId} not found`);
      }

      data.shift = { connect: { id: updateRegistrationDto.shiftId } };
      delete data.shiftId;
    }
    
    if (updateRegistrationDto.paymentId) {
      // Check if payment exists
      const payment = await this.prisma.payment.findUnique({
        where: { id: updateRegistrationDto.paymentId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${updateRegistrationDto.paymentId} not found`);
      }

      data.payment = { connect: { id: updateRegistrationDto.paymentId } };
      delete data.paymentId;
    }

    return this.prisma.registration.update({
      where: { id },
      data,
      include: {
        user: true,
        shift: {
          include: {
            job: true,
            camp: true,
          },
        },
        payment: true,
      },
    });
  }

  /**
   * Delete a registration
   * @param id - The ID of the registration to delete
   * @returns The deleted registration
   * @throws NotFoundException if not found
   */
  async remove(id: string): Promise<Registration> {
    // Check if registration exists
    await this.findOne(id);

    return this.prisma.registration.delete({
      where: { id },
    });
  }
}
