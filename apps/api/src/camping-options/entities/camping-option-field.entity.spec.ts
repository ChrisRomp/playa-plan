import { CampingOptionField, FieldType } from './camping-option-field.entity';

describe('CampingOptionField', () => {
  describe('validateValue', () => {
    it('should validate string fields with minLength constraint', () => {
      // Arrange
      const field = new CampingOptionField({
        id: 'test-id',
        displayName: 'Test Field',
        description: 'Test description',
        dataType: FieldType.STRING,
        required: false,
        minLength: 3,
        maxLength: 10,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act & Assert
      // Valid value
      expect(field.validateValue('test')).toEqual({ valid: true });
      expect(field.validateValue('hello')).toEqual({ valid: true });

      // Too short
      expect(field.validateValue('hi')).toEqual({
        valid: false,
        message: 'Test Field must be at least 3 characters'
      });

      // Too long
      expect(field.validateValue('this is too long')).toEqual({
        valid: false,
        message: 'Test Field must be at most 10 characters'
      });
    });

    it('should validate multiline string fields with minLength constraint', () => {
      // Arrange
      const field = new CampingOptionField({
        id: 'test-id',
        displayName: 'Comments',
        description: 'Test description',
        dataType: FieldType.MULTILINE_STRING,
        required: false,
        minLength: 5,
        maxLength: 100,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act & Assert
      // Valid value
      expect(field.validateValue('Hello world')).toEqual({ valid: true });

      // Too short
      expect(field.validateValue('Hi')).toEqual({
        valid: false,
        message: 'Comments must be at least 5 characters'
      });
    });

    it('should handle null minLength (no minimum constraint)', () => {
      // Arrange
      const field = new CampingOptionField({
        id: 'test-id',
        displayName: 'Test Field',
        description: 'Test description',
        dataType: FieldType.STRING,
        required: false,
        minLength: null,
        maxLength: 10,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act & Assert
      // Should allow empty string when not required and no minLength
      expect(field.validateValue('')).toEqual({ valid: true });
      expect(field.validateValue('a')).toEqual({ valid: true });
    });

    it('should require value when field is required regardless of minLength', () => {
      // Arrange
      const field = new CampingOptionField({
        id: 'test-id',
        displayName: 'Required Field',
        description: 'Test description',
        dataType: FieldType.STRING,
        required: true,
        minLength: 3,
        maxLength: 10,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act & Assert
      // Empty values should fail when required
      expect(field.validateValue('')).toEqual({
        valid: false,
        message: 'Required Field is required'
      });
      expect(field.validateValue(null as any)).toEqual({
        valid: false,
        message: 'Required Field is required'
      });
      expect(field.validateValue(undefined as any)).toEqual({
        valid: false,
        message: 'Required Field is required'
      });
    });

    it('should validate numeric fields without affecting string validation', () => {
      // Arrange
      const numericField = new CampingOptionField({
        id: 'test-id',
        displayName: 'Age',
        description: 'Test description',
        dataType: FieldType.INTEGER,
        required: false,
        minLength: null,
        maxLength: null,
        minValue: 18,
        maxValue: 100,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act & Assert
      expect(numericField.validateValue(25)).toEqual({ valid: true });
      expect(numericField.validateValue(15)).toEqual({
        valid: false,
        message: 'Age must be at least 18'
      });
    });

    it('should skip minLength validation for empty optional fields', () => {
      // Arrange
      const field = new CampingOptionField({
        id: 'test-id',
        displayName: 'Optional Field',
        description: 'Test description',
        dataType: FieldType.STRING,
        required: false,
        minLength: 5,
        maxLength: 10,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act & Assert
      // Empty values should be valid for optional fields (skip other validations)
      expect(field.validateValue('')).toEqual({ valid: true });
      expect(field.validateValue(null as any)).toEqual({ valid: true });
      expect(field.validateValue(undefined as any)).toEqual({ valid: true });
    });
  });
});