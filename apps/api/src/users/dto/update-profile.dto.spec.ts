import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  it('should validate a valid DTO with all profile fields', async () => {
    // Arrange
    const dto = plainToInstance(UpdateProfileDto, {
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'Dusty',
      phone: '+1-555-123-4567',
      city: 'San Francisco',
      stateProvince: 'CA',
      country: 'United States',
      emergencyContact: 'Jane Doe, +1-555-987-6543, relationship: sister',
      profilePicture: 'https://mycamp.playaplan.app/profile.jpg',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate an empty DTO (all fields optional)', async () => {
    // Arrange
    const dto = plainToInstance(UpdateProfileDto, {});

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate with a valid email', async () => {
    // Arrange
    const dto = plainToInstance(UpdateProfileDto, {
      email: 'valid@example.playaplan.app',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid email', async () => {
    // Arrange
    const dto = plainToInstance(UpdateProfileDto, {
      email: 'not-an-email',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEmail');
  });

  it('should validate with minimum length password', async () => {
    // Arrange
    const dto = plainToInstance(UpdateProfileDto, {
      password: '12345678',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation with short password', async () => {
    // Arrange
    const dto = plainToInstance(UpdateProfileDto, {
      password: '1234567',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should fail validation when firstName exceeds maximum length', async () => {
    // Arrange
    const dto = plainToInstance(UpdateProfileDto, {
      firstName: 'A'.repeat(51),
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('should trim whitespace from string fields', async () => {
    // Arrange
    const dto = plainToInstance(UpdateProfileDto, {
      firstName: '  John  ',
      lastName: '  Doe  ',
      playaName: '  Dusty  ',
      phone: '  +1-555-123-4567  ',
      city: '  San Francisco  ',
      stateProvince: '  CA  ',
      country: '  United States  ',
      emergencyContact: '  Jane Doe, sister  ',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
    expect(dto.firstName).toBe('John');
    expect(dto.lastName).toBe('Doe');
    expect(dto.playaName).toBe('Dusty');
    expect(dto.phone).toBe('+1-555-123-4567');
    expect(dto.city).toBe('San Francisco');
    expect(dto.stateProvince).toBe('CA');
    expect(dto.country).toBe('United States');
    expect(dto.emergencyContact).toBe('Jane Doe, sister');
  });

  it('should not have admin-only field decorators (whitelist strips undeclared fields)', async () => {
    // Arrange - when using whitelist:true in ValidationPipe, undeclared fields are stripped.
    // At the DTO level, we verify that admin fields are NOT declared properties.
    const dto = new UpdateProfileDto();

    // Assert - admin fields should not be declared on the prototype
    const declaredProperties = Object.getOwnPropertyNames(dto);
    expect(declaredProperties).not.toContain('allowRegistration');
    expect(declaredProperties).not.toContain('allowEarlyRegistration');
    expect(declaredProperties).not.toContain('allowDeferredDuesPayment');
    expect(declaredProperties).not.toContain('allowNoJob');
    expect(declaredProperties).not.toContain('role');
  });
});
