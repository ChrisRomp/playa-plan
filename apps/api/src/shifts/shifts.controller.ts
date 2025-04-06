import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto, UpdateShiftDto } from './dto';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('shifts')
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create a new shift' })
  @ApiCreatedResponse({ description: 'The shift has been successfully created.' })
  create(@Body() createShiftDto: CreateShiftDto) {
    return this.shiftsService.create(createShiftDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all shifts' })
  @ApiOkResponse({ description: 'Returns all shifts.' })
  findAll() {
    return this.shiftsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shift by id' })
  @ApiOkResponse({ description: 'Returns the shift with the specified id.' })
  findOne(@Param('id') id: string) {
    return this.shiftsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Update a shift' })
  @ApiOkResponse({ description: 'The shift has been successfully updated.' })
  update(@Param('id') id: string, @Body() updateShiftDto: UpdateShiftDto) {
    return this.shiftsService.update(id, updateShiftDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a shift' })
  @ApiOkResponse({ description: 'The shift has been successfully deleted.' })
  remove(@Param('id') id: string) {
    return this.shiftsService.remove(id);
  }
} 