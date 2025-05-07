import {
  Controller,
  Get,
  UseInterceptors,
  ClassSerializerInterceptor,
  NotFoundException,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { CoreConfigService } from '../services/core-config.service';
import { PublicCoreConfigDto } from '../dto';

/**
 * Controller for public core configuration endpoints
 * These endpoints don't require authentication
 */
@ApiTags('public')
@Controller('public/config')
@UseInterceptors(ClassSerializerInterceptor)
@Public() // Mark the entire controller as public
export class PublicConfigController {
  constructor(private readonly coreConfigService: CoreConfigService) {}

  /**
   * Get public UI configuration elements (no authentication required)
   */
  @ApiOperation({ summary: 'Get public UI configuration' })
  @ApiResponse({
    status: 200,
    description: 'Public UI configuration data.',
    type: PublicCoreConfigDto,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async getPublicConfig(): Promise<PublicCoreConfigDto> {
    try {
      const config = await this.coreConfigService.findCurrent();
      
      // Map to PublicCoreConfigDto to expose all fields needed by the frontend schema
      return new PublicCoreConfigDto({
        id: config.id, // Required by schema
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
        // Additional fields required by the frontend Zod schema
        allowDeferredDuesPayment: config.allowDeferredDuesPayment,
        stripeEnabled: config.stripeEnabled,
        stripePublicKey: config.stripePublicKey,
        paypalEnabled: config.paypalEnabled,
        paypalClientId: config.paypalClientId,
        paypalMode: config.paypalMode,
        timeZone: config.timeZone,
        // Convert Date objects to ISO strings to match Zod schema expectations
        createdAt: config.createdAt instanceof Date ? config.createdAt.toISOString() : config.createdAt,
        updatedAt: config.updatedAt instanceof Date ? config.updatedAt.toISOString() : config.updatedAt
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Core configuration not found');
    }
  }
}
