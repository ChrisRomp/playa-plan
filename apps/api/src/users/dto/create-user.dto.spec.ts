import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  it('should validate a valid DTO with required fields', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate a valid DTO with all fields', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'Dusty',
      phone: '+1-555-123-4567',
      city: 'San Francisco',
      stateProvince: 'CA',
      country: 'United States',
      emergencyContact: 'Jane Doe, +1-555-987-6543, relationship: sister',
      profilePicture: 'https://mycamp.playaplan.app/profile.jpg',
      internalNotes: 'Test notes'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation when firstName is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: '', // Empty string, min length is 1
      lastName: 'Doe'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when lastName is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when playaName is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      playaName: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when phone is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      phone: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when city is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      city: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when stateProvince is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      stateProvince: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when country is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      country: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when emergencyContact is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      emergencyContact: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when profilePicture is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      profilePicture: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when internalNotes is empty string', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'test@example.playaplan.app',
      firstName: 'John',
      lastName: 'Doe',
      internalNotes: '' // Empty string, min length is 1
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 1 character');
  });

  it('should fail validation when email is invalid', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      email: 'not-an-email',
      firstName: 'John',
      lastName: 'Doe'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEmail');
  });

  it('should fail validation when required fields are missing', async () => {
    // Arrange
    const dto = plainToInstance(CreateUserDto, {
      // Missing required fields
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    // Should have errors for missing email, firstName, and lastName
    const properties = errors.map(error => error.property);
    expect(properties).toContain('email');
    expect(properties).toContain('firstName');
    expect(properties).toContain('lastName');
  });
});