import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AdminUpdateUserDto } from './admin-update-user.dto';

describe('AdminUpdateUserDto', () => {
  it('should validate a valid DTO with all fields including admin-only', async () => {
    // Arrange
    const dto = plainToInstance(AdminUpdateUserDto, {
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'Dusty',
      allowRegistration: true,
      allowEarlyRegistration: false,
      allowDeferredDuesPayment: true,
      allowNoJob: false,
      role: 'ADMIN',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate with only profile fields (inherits from UpdateProfileDto)', async () => {
    // Arrange
    const dto = plainToInstance(AdminUpdateUserDto, {
      firstName: 'John',
      lastName: 'Doe',
      email: 'test@example.playaplan.app',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate with only admin-only fields', async () => {
    // Arrange
    const dto = plainToInstance(AdminUpdateUserDto, {
      allowRegistration: true,
      allowEarlyRegistration: true,
      allowDeferredDuesPayment: false,
      allowNoJob: true,
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should validate with role field', async () => {
    // Arrange
    const dto = plainToInstance(AdminUpdateUserDto, {
      role: 'STAFF',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid role', async () => {
    // Arrange
    const dto = plainToInstance(AdminUpdateUserDto, {
      role: 'INVALID_ROLE',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when allowRegistration is not a boolean', async () => {
    // Arrange
    const dto = plainToInstance(AdminUpdateUserDto, {
      allowRegistration: 'yes',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });

  it('should fail validation with invalid email (inherited from UpdateProfileDto)', async () => {
    // Arrange
    const dto = plainToInstance(AdminUpdateUserDto, {
      email: 'not-an-email',
    });

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEmail');
  });

  it('should validate an empty DTO (all fields optional)', async () => {
    // Arrange
    const dto = plainToInstance(AdminUpdateUserDto, {});

    // Act
    const errors = await validate(dto);

    // Assert
    expect(errors.length).toBe(0);
  });
});
