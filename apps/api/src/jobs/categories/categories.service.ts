import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    return this.prisma.jobCategory.create({
      data: createCategoryDto,
    });
  }

  async findAll() {
    return this.prisma.jobCategory.findMany({
      include: {
        jobs: true,
      },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.jobCategory.findUnique({
      where: { id },
      include: {
        jobs: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    try {
      return await this.prisma.jobCategory.update({
        where: { id },
        data: updateCategoryDto,
        include: {
          jobs: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.jobCategory.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
  }
} 