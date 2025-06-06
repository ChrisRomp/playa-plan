import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCategoryDto } from './create-category.dto';

describe('CreateCategoryDto', () => {
  it('should validate a valid DTO with all fields', async () => {
    // Arrange
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Kitchen',
      description: 'Kitchen related jobs',
      staffOnly: false,
      alwaysRequired: false
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate with required fields only', async () => {
    // Arrange
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Kitchen',
      description: 'Kitchen related jobs'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation when name is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateCategoryDto, {
      name: '', // Empty string, min length is 1
      description: 'Kitchen related jobs'
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
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Kitchen',
      description: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when name is missing', async () => {
    // Arrange
    const dto = plainToInstance(CreateCategoryDto, {
      description: 'Kitchen related jobs'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    const properties = errors.map(error => error.property);
    expect(properties).toContain('name');
  });

  it('should fail validation when description is missing', async () => {
    // Arrange
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Kitchen'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    const properties = errors.map(error => error.property);
    expect(properties).toContain('description');
  });
});