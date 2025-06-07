import { CampingOptionField, FieldType } from '../entities/camping-option-field.entity';

describe('CampingOptionField - String Validation', () => {
  describe('String Field with Min and Max Length Validation', () => {
    let stringFieldWithLimits: CampingOptionField;

    beforeEach(() => {
      stringFieldWithLimits = new CampingOptionField({
        id: 'test-string-id',
        displayName: 'Bio',
        description: 'Tell us about yourself',
        dataType: FieldType.STRING,
        required: false,
        maxLength: 10,
        minLength: 5,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should be valid when text length is within min and max bounds', () => {
      const result = stringFieldWithLimits.validateValue('hello');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when text length equals minimum length', () => {
      const result = stringFieldWithLimits.validateValue('12345');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when text length equals maximum length', () => {
      const result = stringFieldWithLimits.validateValue('1234567890');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be invalid when text length is below minimum', () => {
      const result = stringFieldWithLimits.validateValue('hi');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Bio must be at least 5 characters');
    });

    it('should be invalid when text length exceeds maximum', () => {
      const result = stringFieldWithLimits.validateValue('this is too long');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Bio must be at most 10 characters');
    });

    it('should be valid when field is not required and value is empty', () => {
      const result = stringFieldWithLimits.validateValue('');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be valid when field is not required and value is null', () => {
      const result = stringFieldWithLimits.validateValue(null);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  describe('Required String Field with Min Length', () => {
    let requiredStringField: CampingOptionField;

    beforeEach(() => {
      requiredStringField = new CampingOptionField({
        id: 'test-required-string-id',
        displayName: 'Name',
        description: 'Your full name',
        dataType: FieldType.STRING,
        required: true,
        maxLength: null,
        minLength: 3,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should be invalid when required field is empty', () => {
      const result = requiredStringField.validateValue('');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Name is required');
    });

    it('should be invalid when required field is null', () => {
      const result = requiredStringField.validateValue(null);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Name is required');
    });

    it('should be invalid when required field has value below minimum length', () => {
      const result = requiredStringField.validateValue('Jo');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Name must be at least 3 characters');
    });

    it('should be valid when required field has value meeting minimum length', () => {
      const result = requiredStringField.validateValue('Joe');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  describe('String Field with Only Min Length', () => {
    let minOnlyField: CampingOptionField;

    beforeEach(() => {
      minOnlyField = new CampingOptionField({
        id: 'test-min-only-id',
        displayName: 'Comment',
        description: 'Leave a comment',
        dataType: FieldType.MULTILINE_STRING,
        required: false,
        maxLength: null,
        minLength: 10,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should be valid when text meets minimum length', () => {
      const result = minOnlyField.validateValue('This is a valid comment');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should be invalid when text is below minimum length', () => {
      const result = minOnlyField.validateValue('Too short');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Comment must be at least 10 characters');
    });

    it('should be valid when field is not required and empty', () => {
      const result = minOnlyField.validateValue('');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });
});

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