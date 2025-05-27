import { Test } from '@nestjs/testing';
import { CoreConfigModule } from './core-config.module';
import { CoreConfigService } from './services/core-config.service';
import { CoreConfigController } from './controllers/core-config.controller';

// Save original environment
const originalEnv = process.env;

describe('CoreConfigModule', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.DATABASE_URL = 'file:./test.db?connection_limit=1';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should compile the module', async () => {
    const module = await Test.createTestingModule({
      imports: [CoreConfigModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should provide CoreConfigService', async () => {
    const module = await Test.createTestingModule({
      imports: [CoreConfigModule],
    }).compile();

    const service = module.get<CoreConfigService>(CoreConfigService);
    expect(service).toBeDefined();
  });

  it('should provide CoreConfigController', async () => {
    const module = await Test.createTestingModule({
      imports: [CoreConfigModule],
    }).compile();

    const controller = module.get<CoreConfigController>(CoreConfigController);
    expect(controller).toBeDefined();
  });
});