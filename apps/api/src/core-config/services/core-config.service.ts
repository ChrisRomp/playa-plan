import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCoreConfigDto, UpdateCoreConfigDto } from '../dto';
import { CoreConfig } from '../entities/core-config.entity';

/**
 * Service for managing core site configuration
 */
@Injectable()
export class CoreConfigService {
  /**
   * Constructor for the CoreConfigService
   * @param prisma - The PrismaService for database access
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create initial core configuration
   * @param createCoreConfigDto - The data for creating the core configuration
   * @returns The created core configuration
   */
  async create(createCoreConfigDto: CreateCoreConfigDto): Promise<CoreConfig> {
    try {
      // Check if configuration already exists
      const existingConfig = await this.findAll();
      if (existingConfig.length > 0) {
        throw new BadRequestException('Core configuration already exists. Use update instead.');
      }

      const result = await this.prisma.$queryRaw`
        INSERT INTO "core_config" (
          id,
          "campName",
          "campDescription",
          "homePageBlurb",
          "campBannerUrl",
          "campIconUrl",
          "registrationYear",
          "earlyRegistrationOpen",
          "registrationOpen",
          "registrationTerms",
          "allowDeferredDuesPayment",
          "stripeEnabled",
          "stripePublicKey",
          "stripeApiKey",
          "stripeWebhookSecret",
          "paypalEnabled",
          "paypalClientId",
          "paypalClientSecret",
          "paypalMode",
          "smtpHost",
          "smtpPort",
          "smtpUsername",
          "smtpPassword",
          "smtpUseSsl",
          "senderEmail",
          "senderName",
          "timeZone",
          "createdAt",
          "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${createCoreConfigDto.campName},
          ${createCoreConfigDto.campDescription || null},
          ${createCoreConfigDto.homePageBlurb || null},
          ${createCoreConfigDto.campBannerUrl || null},
          ${createCoreConfigDto.campIconUrl || null},
          ${createCoreConfigDto.registrationYear},
          ${createCoreConfigDto.earlyRegistrationOpen !== undefined ? createCoreConfigDto.earlyRegistrationOpen : false},
          ${createCoreConfigDto.registrationOpen !== undefined ? createCoreConfigDto.registrationOpen : false},
          ${createCoreConfigDto.registrationTerms || null},
          ${createCoreConfigDto.allowDeferredDuesPayment !== undefined ? createCoreConfigDto.allowDeferredDuesPayment : false},
          ${createCoreConfigDto.stripeEnabled !== undefined ? createCoreConfigDto.stripeEnabled : false},
          ${createCoreConfigDto.stripePublicKey || null},
          ${createCoreConfigDto.stripeApiKey || null},
          ${createCoreConfigDto.stripeWebhookSecret || null},
          ${createCoreConfigDto.paypalEnabled !== undefined ? createCoreConfigDto.paypalEnabled : false},
          ${createCoreConfigDto.paypalClientId || null},
          ${createCoreConfigDto.paypalClientSecret || null},
          ${createCoreConfigDto.paypalMode || 'sandbox'},
          ${createCoreConfigDto.smtpHost || null},
          ${createCoreConfigDto.smtpPort || null},
          ${createCoreConfigDto.smtpUsername || null},
          ${createCoreConfigDto.smtpPassword || null},
          ${createCoreConfigDto.smtpUseSsl !== undefined ? createCoreConfigDto.smtpUseSsl : false},
          ${createCoreConfigDto.senderEmail || null},
          ${createCoreConfigDto.senderName || null},
          ${createCoreConfigDto.timeZone || 'UTC'},
          now(),
          now()
        )
        RETURNING *
      `;

      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new BadRequestException('Failed to create core configuration');
      }

      return new CoreConfig(result[0]);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException('Failed to create core configuration: ' + errorMessage);
    }
  }

  /**
   * Get all core configurations
   * @returns Array of core configurations (should be max 1 in practice)
   */
  async findAll(): Promise<CoreConfig[]> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT * FROM "core_config" ORDER BY "createdAt" DESC
      `;

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(config => new CoreConfig(config));
    } catch (error: unknown) {
      return [];
    }
  }

  /**
   * Get the current core configuration
   * @returns The current core configuration
   */
  async findCurrent(): Promise<CoreConfig> {
    const configs = await this.findAll();
    
    if (configs.length === 0) {
      throw new NotFoundException('Core configuration not found');
    }
    
    return configs[0];
  }

  /**
   * Get a specific core configuration by ID
   * @param id - ID of the configuration to find
   * @returns The core configuration
   */
  async findOne(id: string): Promise<CoreConfig> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT * FROM "core_config" WHERE id = ${id}::uuid
      `;

      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new NotFoundException(`Core configuration with ID ${id} not found`);
      }

      return new CoreConfig(result[0]);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Core configuration with ID ${id} not found`);
    }
  }

  /**
   * Update a core configuration
   * @param id - ID of the configuration to update
   * @param updateCoreConfigDto - Data to update
   * @returns The updated core configuration
   */
  async update(id: string, updateCoreConfigDto: UpdateCoreConfigDto): Promise<CoreConfig> {
    try {
      // Make sure the config exists
      await this.findOne(id);

      // Build the SET clause dynamically
      const setClauses: string[] = [];
      const values: Array<string | number | boolean | Date | null> = [];
      let paramIndex = 1;

      // Helper function to add a clause if the field is defined
      const addClause = (field: string, value: unknown) => {
        if (value !== undefined) {
          setClauses.push(`"${field}" = $${paramIndex++}`);
          values.push(value === null ? null : value as string | number | boolean | null);
        }
      };

      // Add clauses for all fields
      addClause('campName', updateCoreConfigDto.campName);
      addClause('campDescription', updateCoreConfigDto.campDescription);
      addClause('homePageBlurb', updateCoreConfigDto.homePageBlurb);
      addClause('campBannerUrl', updateCoreConfigDto.campBannerUrl);
      addClause('campIconUrl', updateCoreConfigDto.campIconUrl);
      addClause('registrationYear', updateCoreConfigDto.registrationYear);
      addClause('earlyRegistrationOpen', updateCoreConfigDto.earlyRegistrationOpen);
      addClause('registrationOpen', updateCoreConfigDto.registrationOpen);
      addClause('registrationTerms', updateCoreConfigDto.registrationTerms);
      addClause('allowDeferredDuesPayment', updateCoreConfigDto.allowDeferredDuesPayment);
      addClause('stripeEnabled', updateCoreConfigDto.stripeEnabled);
      addClause('stripePublicKey', updateCoreConfigDto.stripePublicKey);
      addClause('stripeApiKey', updateCoreConfigDto.stripeApiKey);
      addClause('stripeWebhookSecret', updateCoreConfigDto.stripeWebhookSecret);
      addClause('paypalEnabled', updateCoreConfigDto.paypalEnabled);
      addClause('paypalClientId', updateCoreConfigDto.paypalClientId);
      addClause('paypalClientSecret', updateCoreConfigDto.paypalClientSecret);
      addClause('paypalMode', updateCoreConfigDto.paypalMode);
      addClause('smtpHost', updateCoreConfigDto.smtpHost);
      addClause('smtpPort', updateCoreConfigDto.smtpPort);
      addClause('smtpUsername', updateCoreConfigDto.smtpUsername);
      addClause('smtpPassword', updateCoreConfigDto.smtpPassword);
      addClause('smtpUseSsl', updateCoreConfigDto.smtpUseSsl);
      addClause('senderEmail', updateCoreConfigDto.senderEmail);
      addClause('senderName', updateCoreConfigDto.senderName);
      addClause('timeZone', updateCoreConfigDto.timeZone);

      // Always update the updatedAt field
      setClauses.push(`"updatedAt" = $${paramIndex++}`);
      values.push(new Date());

      if (setClauses.length === 1 && setClauses[0].includes('updatedAt')) {
        // Only updatedAt was set, no actual updates
        return this.findOne(id);
      }

      const query = `
        UPDATE "core_config"
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex++}::uuid
        RETURNING *
      `;

      values.push(id);

      const result = await this.prisma.$queryRawUnsafe(query, ...values);

      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new NotFoundException(`Core configuration with ID ${id} not found`);
      }

      return new CoreConfig(result[0]);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to update core configuration: ${errorMessage}`);
    }
  }

  /**
   * Delete a core configuration
   * @param id - ID of the configuration to delete
   * @returns The deleted core configuration
   */
  async remove(id: string): Promise<CoreConfig> {
    try {
      // Make sure the config exists
      const config = await this.findOne(id);

      const result = await this.prisma.$queryRaw`
        DELETE FROM "core_config" WHERE id = ${id}::uuid
        RETURNING *
      `;

      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new NotFoundException(`Core configuration with ID ${id} not found`);
      }

      return config;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to delete core configuration: ${errorMessage}`);
    }
  }

  /**
   * Admin test endpoint
   * @returns A test message
   */
  adminTest(): string {
    return 'Core Config module is working!';
  }
} 