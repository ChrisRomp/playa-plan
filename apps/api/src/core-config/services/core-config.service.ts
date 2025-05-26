import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCoreConfigDto, UpdateCoreConfigDto } from '../dto';
import { CoreConfig } from '../entities/core-config.entity';
import { CoreConfig as PrismaCoreConfig, Prisma } from '@prisma/client';

/**
 * Service for managing core site configuration
 */
@Injectable()
export class CoreConfigService {
  private readonly logger = new Logger(CoreConfigService.name);

  /**
   * Constructor for the CoreConfigService
   * @param prisma - The PrismaService for database access
   */
  constructor(private readonly prisma: PrismaService) {}
  
  /**
   * Helper to map Prisma CoreConfig to entity
   */
  private mapToEntity(config: PrismaCoreConfig): CoreConfig {
    return new CoreConfig({
      id: config.id,
      campName: config.campName,
      campDescription: config.campDescription,
      homePageBlurb: config.homePageBlurb,
      campBannerUrl: config.campBannerUrl,
      campBannerAltText: config.campBannerAltText,
      campIconUrl: config.campIconUrl,
      campIconAltText: config.campIconAltText,
      registrationYear: config.registrationYear,
      earlyRegistrationOpen: config.earlyRegistrationOpen,
      registrationOpen: config.registrationOpen,
      registrationTerms: config.registrationTerms,
      allowDeferredDuesPayment: config.allowDeferredDuesPayment,
      stripeEnabled: config.stripeEnabled,
      stripePublicKey: config.stripePublicKey,
      stripeApiKey: config.stripeApiKey,
      paypalEnabled: config.paypalEnabled,
      paypalClientId: config.paypalClientId,
      paypalClientSecret: config.paypalClientSecret,
      paypalMode: config.paypalMode === 'LIVE' ? 'live' : 'sandbox',
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      // Map the DB fields to entity fields (the entity uses different names)
      smtpUsername: config.smtpUser,
      smtpPassword: config.smtpPassword,
      smtpUseSsl: config.smtpSecure,
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      timeZone: config.timeZone,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  }

  /**
   * Create initial core configuration
   * @param createCoreConfigDto - The data for creating the core configuration
   * @returns The created core configuration
   */
  async create(createCoreConfigDto: CreateCoreConfigDto): Promise<CoreConfig> {
    try {
      // Check if configuration already exists
      const existingConfig = await this.prisma.coreConfig.findMany();
      if (existingConfig.length > 0) {
        throw new BadRequestException('Core configuration already exists. Use update instead.');
      }

      const created = await this.prisma.coreConfig.create({
        data: {
          campName: createCoreConfigDto.campName,
          campDescription: createCoreConfigDto.campDescription ?? null,
          homePageBlurb: createCoreConfigDto.homePageBlurb ?? null,
          campBannerUrl: createCoreConfigDto.campBannerUrl ?? null,
          campBannerAltText: createCoreConfigDto.campBannerAltText ?? null,
          campIconUrl: createCoreConfigDto.campIconUrl ?? null,
          campIconAltText: createCoreConfigDto.campIconAltText ?? null,
          registrationYear: createCoreConfigDto.registrationYear,
          earlyRegistrationOpen: createCoreConfigDto.earlyRegistrationOpen ?? false,
          registrationOpen: createCoreConfigDto.registrationOpen ?? false,
          registrationTerms: createCoreConfigDto.registrationTerms ?? null,
          allowDeferredDuesPayment: createCoreConfigDto.allowDeferredDuesPayment ?? false,
          stripeEnabled: createCoreConfigDto.stripeEnabled ?? false,
          stripePublicKey: createCoreConfigDto.stripePublicKey ?? null,
          stripeApiKey: createCoreConfigDto.stripeApiKey ?? null,
          paypalEnabled: createCoreConfigDto.paypalEnabled ?? false,
          paypalClientId: createCoreConfigDto.paypalClientId ?? null,
          paypalClientSecret: createCoreConfigDto.paypalClientSecret ?? null,
          paypalMode: (createCoreConfigDto.paypalMode === 'live' ? 'LIVE' : 'SANDBOX'),
          smtpHost: createCoreConfigDto.smtpHost ?? null,
          smtpPort: createCoreConfigDto.smtpPort ?? null,
          // Map entity field names to DB column names
          smtpUser: createCoreConfigDto.smtpUsername ?? null,
          smtpPassword: createCoreConfigDto.smtpPassword ?? null,
          smtpSecure: createCoreConfigDto.smtpUseSsl ?? false,
          senderEmail: createCoreConfigDto.senderEmail ?? null,
          senderName: createCoreConfigDto.senderName ?? null,
          timeZone: createCoreConfigDto.timeZone ?? 'UTC',
        },
      });
      
      return this.mapToEntity(created);
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
      const result = await this.prisma.coreConfig.findMany({ 
        orderBy: { createdAt: 'desc' } 
      });
      
      return result.map(config => this.mapToEntity(config));
    } catch (error: unknown) {
      return [];
    }
  }

  /**
   * Generate a default configuration for new installations
   * @returns A default CoreConfig entity
   */
  private createDefaultConfig(): CoreConfig {
    this.logger.log('No configuration found in database, creating default configuration');
    
    const currentYear = new Date().getFullYear();
    
    return new CoreConfig({
      id: 'default',
      campName: 'PlayaPlan',
      campDescription: 'A Burning Man camp registration and planning tool',
      homePageBlurb: '<h2>Welcome to PlayaPlan</h2><p>Please log in as an admin and configure your site.</p>',
      campBannerUrl: '/images/playa-plan-banner.png',
      campBannerAltText: 'Desert landscape at sunset with art installations',
      campIconUrl: '/icons/playa-plan-icon.png',
      campIconAltText: 'PlayaPlan camp icon',
      registrationYear: currentYear,
      earlyRegistrationOpen: false,
      registrationOpen: false,
      registrationTerms: null,
      allowDeferredDuesPayment: false,
      stripeEnabled: false,
      stripePublicKey: null,
      stripeApiKey: null,
      paypalEnabled: false,
      paypalClientId: null,
      paypalClientSecret: null,
      paypalMode: 'sandbox',
      smtpHost: null,
      smtpPort: null,
      smtpUsername: null,
      smtpPassword: null,
      smtpUseSsl: false,
      senderEmail: null,
      senderName: null,
      timeZone: 'UTC',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Get the current core configuration
   * @param useDefault - Whether to return a default config if none exists (default: true)
   * @returns The current core configuration
   */
  async findCurrent(useDefault = true): Promise<CoreConfig> {
    const configs = await this.findAll();
    
    if (configs.length === 0) {
      if (useDefault) {
        // Return a default configuration instead of throwing an error
        return this.createDefaultConfig();
      }
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
      const config = await this.prisma.coreConfig.findUnique({ 
        where: { id } 
      });

      if (!config) {
        throw new NotFoundException(`Core configuration with ID ${id} not found`);
      }

      return this.mapToEntity(config);
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
      
      // Map DTO fields to Prisma model fields
      const data: Prisma.CoreConfigUpdateInput = {};
      if (updateCoreConfigDto.campName !== undefined) data.campName = updateCoreConfigDto.campName;
      if (updateCoreConfigDto.campDescription !== undefined) data.campDescription = updateCoreConfigDto.campDescription;
      if (updateCoreConfigDto.homePageBlurb !== undefined) data.homePageBlurb = updateCoreConfigDto.homePageBlurb;
      if (updateCoreConfigDto.campBannerUrl !== undefined) data.campBannerUrl = updateCoreConfigDto.campBannerUrl;
      if (updateCoreConfigDto.campBannerAltText !== undefined) data.campBannerAltText = updateCoreConfigDto.campBannerAltText;
      if (updateCoreConfigDto.campIconUrl !== undefined) data.campIconUrl = updateCoreConfigDto.campIconUrl;
      if (updateCoreConfigDto.campIconAltText !== undefined) data.campIconAltText = updateCoreConfigDto.campIconAltText;
      if (updateCoreConfigDto.registrationYear !== undefined) data.registrationYear = updateCoreConfigDto.registrationYear;
      if (updateCoreConfigDto.earlyRegistrationOpen !== undefined) data.earlyRegistrationOpen = updateCoreConfigDto.earlyRegistrationOpen;
      if (updateCoreConfigDto.registrationOpen !== undefined) data.registrationOpen = updateCoreConfigDto.registrationOpen;
      if (updateCoreConfigDto.registrationTerms !== undefined) data.registrationTerms = updateCoreConfigDto.registrationTerms;
      if (updateCoreConfigDto.allowDeferredDuesPayment !== undefined) data.allowDeferredDuesPayment = updateCoreConfigDto.allowDeferredDuesPayment;
      if (updateCoreConfigDto.stripeEnabled !== undefined) data.stripeEnabled = updateCoreConfigDto.stripeEnabled;
      if (updateCoreConfigDto.stripePublicKey !== undefined) data.stripePublicKey = updateCoreConfigDto.stripePublicKey;
      if (updateCoreConfigDto.stripeApiKey !== undefined) data.stripeApiKey = updateCoreConfigDto.stripeApiKey;
      if (updateCoreConfigDto.paypalEnabled !== undefined) data.paypalEnabled = updateCoreConfigDto.paypalEnabled;
      if (updateCoreConfigDto.paypalClientId !== undefined) data.paypalClientId = updateCoreConfigDto.paypalClientId;
      if (updateCoreConfigDto.paypalClientSecret !== undefined) data.paypalClientSecret = updateCoreConfigDto.paypalClientSecret;
      if (updateCoreConfigDto.paypalMode !== undefined) data.paypalMode = (updateCoreConfigDto.paypalMode === 'live' ? 'LIVE' : 'SANDBOX');
      if (updateCoreConfigDto.smtpHost !== undefined) data.smtpHost = updateCoreConfigDto.smtpHost;
      if (updateCoreConfigDto.smtpPort !== undefined) data.smtpPort = updateCoreConfigDto.smtpPort;
      if (updateCoreConfigDto.smtpUsername !== undefined) data.smtpUser = updateCoreConfigDto.smtpUsername;
      if (updateCoreConfigDto.smtpPassword !== undefined) data.smtpPassword = updateCoreConfigDto.smtpPassword;
      if (updateCoreConfigDto.smtpUseSsl !== undefined) data.smtpSecure = updateCoreConfigDto.smtpUseSsl;
      if (updateCoreConfigDto.senderEmail !== undefined) data.senderEmail = updateCoreConfigDto.senderEmail;
      if (updateCoreConfigDto.senderName !== undefined) data.senderName = updateCoreConfigDto.senderName;
      if (updateCoreConfigDto.timeZone !== undefined) data.timeZone = updateCoreConfigDto.timeZone;

      // Always update the updatedAt field
      data.updatedAt = new Date();
      
      // If no fields to update, just return the existing record
      if (Object.keys(data).length === 1 && data.updatedAt) {
        return this.findOne(id);
      }

      const updated = await this.prisma.coreConfig.update({ 
        where: { id }, 
        data 
      });
      
      return this.mapToEntity(updated);
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
      
      // Delete the configuration
      await this.prisma.coreConfig.delete({
        where: { id }
      });

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