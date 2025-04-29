import { Test } from '@nestjs/testing';
import { CoreConfigModule } from './core-config.module';
import { CoreConfigService } from './services/core-config.service';
import { CoreConfigController } from './controllers/core-config.controller';

describe('CoreConfigModule', () => {
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