import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async create(createJobDto: CreateJobDto) {
    return this.prisma.job.create({
      data: createJobDto,
      include: {
        category: true,
      },
    });
  }

  async findAll() {
    return this.prisma.job.findMany({
      include: {
        category: true,
      },
    });
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto) {
    try {
      return await this.prisma.job.update({
        where: { id },
        data: updateJobDto,
        include: {
          category: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.job.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
  }
} 