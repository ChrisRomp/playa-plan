import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCampingOptionFieldDto } from './create-camping-option-field.dto';
import { FieldType } from '../entities/camping-option-field.entity';

describe('CreateCampingOptionFieldDto', () => {
  const validCampingOptionId = '550e8400-e29b-41d4-a716-446655440000';

  describe('minLength validation', () => {
    it('should pass validation with valid minLength for STRING field', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        displayName: 'Test Field',
        dataType: FieldType.STRING,
        minLength: 5,
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation with valid minLength for MULTILINE_STRING field', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        displayName: 'Test Field',
        dataType: FieldType.MULTILINE_STRING,
        minLength: 10,
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation with minLength of 0', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        displayName: 'Test Field',
        dataType: FieldType.STRING,
        minLength: 0,
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with negative minLength', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        displayName: 'Test Field',
        dataType: FieldType.STRING,
        minLength: -1,
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should pass validation when minLength is not provided for STRING field', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        displayName: 'Test Field',
        dataType: FieldType.STRING,
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation when minLength is provided for non-string field types', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        displayName: 'Test Field',
        dataType: FieldType.NUMBER,
        minLength: 5, // This should be ignored for non-string types
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation with both minLength and maxLength', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        displayName: 'Test Field',
        dataType: FieldType.STRING,
        minLength: 5,
        maxLength: 100,
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('required field validation', () => {
    it('should fail validation when displayName is missing', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        dataType: FieldType.STRING,
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when dataType is missing', async () => {
      const dto = plainToInstance(CreateCampingOptionFieldDto, {
        displayName: 'Test Field',
        campingOptionId: validCampingOptionId,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });
  });
}); 