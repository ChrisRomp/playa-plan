import { CampingOptionField, FieldType } from '../entities/camping-option-field.entity';

describe('CampingOptionField - Boolean Validation', () => {
  describe('Required Boolean Field Validation', () => {
    let requiredBooleanField: CampingOptionField;

    beforeEach(() => {
      requiredBooleanField = new CampingOptionField({
        id: 'test-id',
        displayName: 'Agree to Terms',
        description: 'Do you agree to the terms?',
        dataType: FieldType.BOOLEAN,
        required: true,
        maxLength: null,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should be valid when required boolean field is true', () => {
      const result = requiredBooleanField.validateValue(true);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when required boolean field is false', () => {
      const result = requiredBooleanField.validateValue(false);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when boolean field value is string "true"', () => {
      const result = requiredBooleanField.validateValue('true');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when boolean field value is string "false"', () => {
      const result = requiredBooleanField.validateValue('false');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be invalid when required boolean field is null', () => {
      const result = requiredBooleanField.validateValue(null);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Agree to Terms is required');
    });

    it('should be invalid when required boolean field is undefined', () => {
      const result = requiredBooleanField.validateValue(undefined);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Agree to Terms is required');
    });

    it('should be invalid when required boolean field is empty string', () => {
      const result = requiredBooleanField.validateValue('');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Agree to Terms is required');
    });

    it('should be invalid when boolean field value is not a valid boolean', () => {
      const result = requiredBooleanField.validateValue('invalid');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Agree to Terms must be a boolean value');
    });
  });

  describe('Optional Boolean Field Validation', () => {
    let optionalBooleanField: CampingOptionField;

    beforeEach(() => {
      optionalBooleanField = new CampingOptionField({
        id: 'test-id-2',
        displayName: 'Newsletter Subscription',
        description: 'Would you like to receive our newsletter?',
        dataType: FieldType.BOOLEAN,
        required: false,
        maxLength: null,
        minValue: null,
        maxValue: null,
        order: 2,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should be valid when optional boolean field is true', () => {
      const result = optionalBooleanField.validateValue(true);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when optional boolean field is false', () => {
      const result = optionalBooleanField.validateValue(false);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when optional boolean field is null', () => {
      const result = optionalBooleanField.validateValue(null);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when optional boolean field is undefined', () => {
      const result = optionalBooleanField.validateValue(undefined);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when optional boolean field is empty string', () => {
      const result = optionalBooleanField.validateValue('');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be invalid when optional boolean field has invalid non-empty value', () => {
      const result = optionalBooleanField.validateValue('invalid');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Newsletter Subscription must be a boolean value');
    });
  });
});