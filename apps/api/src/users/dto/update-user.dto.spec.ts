import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  it('should validate a valid DTO with all fields', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'Dusty',
      phone: '+1-555-123-4567',
      city: 'San Francisco',
      stateProvince: 'CA',
      country: 'United States',
      emergencyContact: 'Jane Doe, +1-555-987-6543, relationship: sister',
      profilePicture: 'https://example.com/profile.jpg'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate when all string fields are at maximum allowed length', async () => {
    // Arrange - Create strings of exactly the maximum allowed length
    const maxLengthStrings = {
      firstName: 'A'.repeat(50),
      lastName: 'B'.repeat(50),
      playaName: 'C'.repeat(50),
      phone: 'D'.repeat(50),
      city: 'E'.repeat(50),
      stateProvince: 'F'.repeat(50),
      country: 'G'.repeat(50),
      emergencyContact: 'H'.repeat(1024),
      profilePicture: 'I'.repeat(1024)
    };
    
    const dto = plainToInstance(UpdateUserDto, maxLengthStrings);

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation when firstName exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      firstName: 'A'.repeat(51) // 51 characters, max is 50
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 50 characters');
  });

  it('should fail validation when lastName exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      lastName: 'A'.repeat(51) // 51 characters, max is 50
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 50 characters');
  });

  it('should fail validation when playaName exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      playaName: 'A'.repeat(51) // 51 characters, max is 50
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 50 characters');
  });

  it('should fail validation when phone exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      phone: 'A'.repeat(51) // 51 characters, max is 50
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 50 characters');
  });

  it('should fail validation when city exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      city: 'A'.repeat(51) // 51 characters, max is 50
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 50 characters');
  });

  it('should fail validation when stateProvince exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      stateProvince: 'A'.repeat(51) // 51 characters, max is 50
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 50 characters');
  });

  it('should fail validation when country exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      country: 'A'.repeat(51) // 51 characters, max is 50
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 50 characters');
  });

  it('should fail validation when emergencyContact exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      emergencyContact: 'A'.repeat(1025) // 1025 characters, max is 1024
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 1024 characters');
  });

  it('should fail validation when profilePicture exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      profilePicture: 'A'.repeat(1025) // 1025 characters, max is 1024
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 1024 characters');
  });

  it('should fail validation when internalNotes exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      internalNotes: 'A'.repeat(1025) // 1025 characters, max is 1024
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
    expect(errors[0].constraints?.maxLength).toContain('at most 1024 characters');
  });

  it('should validate an email field with valid email', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      email: 'valid@example.playaplan.app'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid email', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      email: 'not-an-email'
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEmail');
  });

  it('should validate with minimum length password', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      password: '12345678' // 8 characters, min is 8
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation with short password', async () => {
    // Arrange
    const dto = plainToInstance(UpdateUserDto, {
      password: '1234567' // 7 characters, min is 8
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
    expect(errors[0].constraints?.minLength).toContain('at least 8 characters');
  });
});
