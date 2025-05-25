import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCoreConfigDto } from './create-core-config.dto';

describe('CreateCoreConfigDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data including alt text', async () => {
      const plainObject = {
        campName: 'Test Camp',
        registrationYear: 2025,
        campBannerAltText: 'Banner description',
        campIconAltText: 'Icon description'
      };

      const dto = plainToInstance(CreateCoreConfigDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty alt text fields', async () => {
      const plainObject = {
        campName: 'Test Camp',
        registrationYear: 2025,
        campBannerAltText: '',
        campIconAltText: ''
      };

      const dto = plainToInstance(CreateCoreConfigDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation without alt text fields', async () => {
      const plainObject = {
        campName: 'Test Camp',
        registrationYear: 2025
      };

      const dto = plainToInstance(CreateCoreConfigDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when alt text is too long', async () => {
      const longText = 'a'.repeat(251); // Exceeds 250 character limit
      
      const plainObject = {
        campName: 'Test Camp',
        registrationYear: 2025,
        campBannerAltText: longText
      };

      const dto = plainToInstance(CreateCoreConfigDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('campBannerAltText');
      expect(errors[0].constraints).toHaveProperty('isLength');
    });

    it('should fail validation when camp name is missing', async () => {
      const plainObject = {
        registrationYear: 2025
      };

      const dto = plainToInstance(CreateCoreConfigDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('campName');
    });
  });
}); 