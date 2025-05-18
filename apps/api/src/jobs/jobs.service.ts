import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async create(createJobDto: CreateJobDto) {
    const job = await this.prisma.job.create({
      data: {
        name: createJobDto.name,
        description: createJobDto.description,
        location: createJobDto.location,
        maxRegistrations: createJobDto.maxRegistrations || 10, // Default to 10 if not provided
        category: {
          connect: { id: createJobDto.categoryId }
        },
        shift: {
          connect: { id: createJobDto.shiftId }
        }
      },
      include: {
        category: true,
        shift: true,
      },
    });

    // Add derived properties from category
    return this.addDerivedProperties(job);
  }

  async findAll() {
    const jobs = await this.prisma.job.findMany({
      include: {
        category: true,
        shift: true,
      },
    });

    // Add derived properties from categories
    return jobs.map(job => this.addDerivedProperties(job));
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        category: true,
        shift: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    // Add derived properties from category
    return this.addDerivedProperties(job);
  }

  async update(id: string, updateJobDto: UpdateJobDto) {
    try {
      // Create update data object
      const updateData: any = {};
      
      if (updateJobDto.name) updateData.name = updateJobDto.name;
      if (updateJobDto.description) updateData.description = updateJobDto.description;
      if (updateJobDto.location) updateData.location = updateJobDto.location;
      if (updateJobDto.maxRegistrations) updateData.maxRegistrations = updateJobDto.maxRegistrations;
      
      if (updateJobDto.categoryId) {
        updateData.category = { connect: { id: updateJobDto.categoryId } };
      }
      
      if (updateJobDto.shiftId) {
        updateData.shift = { connect: { id: updateJobDto.shiftId } };
      }
      
      const job = await this.prisma.job.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          shift: true,
        },
      });

      // Add derived properties from category
      return this.addDerivedProperties(job);
    } catch (error) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      const job = await this.prisma.job.delete({
        where: { id },
        include: {
          category: true,
          shift: true,
        },
      });

      // Add derived properties from category
      return this.addDerivedProperties(job);
    } catch (error) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
  }

  /**
   * Add derived properties from category to a job
   */
  private addDerivedProperties(job: any) {
    return {
      ...job,
      staffOnly: job.category?.staffOnly || false,
      alwaysRequired: job.category?.alwaysRequired || false,
    };
  }
} 