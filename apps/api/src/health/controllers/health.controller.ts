import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { HealthService } from '../services/health.service';
import { HealthStatus, HealthResponseDto } from '../dto/health-response.dto';

/**
 * Health check controller
 * Provides health status endpoint for monitoring systems
 * GitHub Issue: #31
 */
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Get comprehensive health status
   * Returns 200 for healthy/degraded, 503 for unhealthy
   */
  @Get('health')
  @Public()
  async getHealth(@Res() res: Response): Promise<Response<HealthResponseDto>> {
    const healthStatus = await this.healthService.getHealthStatus();
    
    const statusCode = healthStatus.status === HealthStatus.UNHEALTHY 
      ? HttpStatus.SERVICE_UNAVAILABLE 
      : HttpStatus.OK;
    
    return res.status(statusCode).json(healthStatus);
  }
}