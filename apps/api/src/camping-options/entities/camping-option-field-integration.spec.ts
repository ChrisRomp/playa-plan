import { CampingOptionField, FieldType } from './camping-option-field.entity';

describe('CampingOptionField - Integration Tests for MinLength', () => {
  describe('Real-world scenarios', () => {
    it('should validate a bio field with minimum length requirement', () => {
      const bioField = new CampingOptionField({
        id: 'bio-field-id',
        displayName: 'Tell us about yourself',
        description: 'Please provide a brief bio (minimum 50 characters)',
        dataType: FieldType.MULTILINE_STRING,
        required: false,
        maxLength: 500,
        minLength: 50,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Test cases that match the user requirements
      
      // Field not required, text length 0 = ok
      const emptyResult = bioField.validateValue('');
      expect(emptyResult.valid).toBe(true);
      expect(emptyResult.message).toBeUndefined();

      // Field not required, text length >= minLength = ok
      const validResult = bioField.validateValue('I am a passionate burner who loves art, music, and community. I have been attending regional burns for 5 years.');
      expect(validResult.valid).toBe(true);
      expect(validResult.message).toBeUndefined();

      // Field not required, text length < minLength = not ok
      const tooShortResult = bioField.validateValue('Too short');
      expect(tooShortResult.valid).toBe(false);
      expect(tooShortResult.message).toBe('Tell us about yourself must be at least 50 characters');
    });

    it('should validate a required field with minimum length', () => {
      const nameField = new CampingOptionField({
        id: 'name-field-id',
        displayName: 'Playa Name',
        description: 'Your playa name (minimum 3 characters)',
        dataType: FieldType.STRING,
        required: true,
        maxLength: 50,
        minLength: 3,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Field required, text length 0 = not ok (required validation takes precedence)
      const emptyResult = nameField.validateValue('');
      expect(emptyResult.valid).toBe(false);
      expect(emptyResult.message).toBe('Playa Name is required');

      // Field required, text length < minLength = not ok (minLength validation)
      const tooShortResult = nameField.validateValue('Jo');
      expect(tooShortResult.valid).toBe(false);
      expect(tooShortResult.message).toBe('Playa Name must be at least 3 characters');

      // Field required, text length >= minLength = ok
      const validResult = nameField.validateValue('Dusty');
      expect(validResult.valid).toBe(true);
      expect(validResult.message).toBeUndefined();
    });

    it('should work with only minLength constraint (no maxLength)', () => {
      const commentField = new CampingOptionField({
        id: 'comment-field-id',
        displayName: 'Additional Comments',
        description: 'Any additional comments (minimum 10 characters if provided)',
        dataType: FieldType.MULTILINE_STRING,
        required: false,
        maxLength: null, // No max length limit
        minLength: 10,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Empty is ok since not required
      const emptyResult = commentField.validateValue('');
      expect(emptyResult.valid).toBe(true);

      // Below minimum is not ok
      const tooShortResult = commentField.validateValue('Too short');
      expect(tooShortResult.valid).toBe(false);
      expect(tooShortResult.message).toBe('Additional Comments must be at least 10 characters');

      // Meeting minimum is ok
      const validResult = commentField.validateValue('This is a valid comment that meets the minimum length requirement.');
      expect(validResult.valid).toBe(true);

      // Very long text is ok (no max length)
      const longResult = commentField.validateValue('This is a very long comment that goes on and on and on and would normally exceed a maximum length but since there is no maximum length constraint it should be perfectly valid and accepted by the validation system.');
      expect(longResult.valid).toBe(true);
    });

    it('should work with both minLength and maxLength constraints', () => {
      const descriptionField = new CampingOptionField({
        id: 'description-field-id',
        displayName: 'Project Description',
        description: 'Describe your art project (5-100 characters)',
        dataType: FieldType.STRING,
        required: false,
        maxLength: 100,
        minLength: 5,
        minValue: null,
        maxValue: null,
        order: 1,
        campingOptionId: 'camping-option-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Empty is ok since not required
      const emptyResult = descriptionField.validateValue('');
      expect(emptyResult.valid).toBe(true);

      // Below minimum is not ok
      const tooShortResult = descriptionField.validateValue('Art');
      expect(tooShortResult.valid).toBe(false);
      expect(tooShortResult.message).toBe('Project Description must be at least 5 characters');

      // Above maximum is not ok
      const tooLongResult = descriptionField.validateValue('This is a very long description that exceeds the maximum allowed length of 100 characters and should be rejected by the validation system');
      expect(tooLongResult.valid).toBe(false);
      expect(tooLongResult.message).toBe('Project Description must be at most 100 characters');

      // Within bounds is ok
      const validResult = descriptionField.validateValue('Interactive LED sculpture with sound');
      expect(validResult.valid).toBe(true);
      expect(validResult.message).toBeUndefined();
    });
  });
}); 