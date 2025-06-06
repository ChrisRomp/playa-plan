import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCampingOptionFieldDto } from './create-camping-option-field.dto';
import { FieldType } from '../entities/camping-option-field.entity';

describe('CreateCampingOptionFieldDto', () => {
  it('should validate a valid DTO with all fields', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      displayName: 'Dietary Restrictions',
      description: 'Please list any dietary restrictions or allergies',
      dataType: FieldType.STRING,
      required: false,
      maxLength: 255,
      minLength: 1,
      order: 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate with required fields only', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      displayName: 'Dietary Restrictions',
      dataType: FieldType.STRING
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation when displayName is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      displayName: '', // Empty string, min length is 1
      dataType: FieldType.STRING
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when description is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      displayName: 'Dietary Restrictions',
      description: '', // Empty string, min length is 1
      dataType: FieldType.STRING
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should validate with numeric field constraints', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      displayName: 'Age',
      dataType: FieldType.INTEGER,
      minValue: 18,
      maxValue: 100
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate string field with minLength and maxLength', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      displayName: 'Comments',
      dataType: FieldType.MULTILINE_STRING,
      minLength: 10,
      maxLength: 1000
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation when minLength is negative', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      displayName: 'Comments',
      dataType: FieldType.STRING,
      minLength: -1 // Negative value, min is 0
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('should fail validation when displayName is missing', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      dataType: FieldType.STRING
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    const properties = errors.map(error => error.property);
    expect(properties).toContain('displayName');
  });

  it('should fail validation when dataType is missing', async () => {
    // Arrange
    const dto = plainToInstance(CreateCampingOptionFieldDto, {
      displayName: 'Test Field'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    const properties = errors.map(error => error.property);
    expect(properties).toContain('dataType');
  });
});