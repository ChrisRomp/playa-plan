import { Test } from '@nestjs/testing';
import { GlobalValidationPipe } from './validation.pipe';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';

/**
 * Test DTO with class-validator decorators for validation testing
 */
class TestDto {
  @IsEmail()
  email: string = '';

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string = '';

  @IsOptional()
  @IsString()
  name?: string;
}

/**
 * Test DTO with nested object for testing complex validation
 */
class NestedTestDto {
  @IsString()
  parentField: string = '';

  @IsOptional()
  child?: TestDto;
}

describe('GlobalValidationPipe', () => {
  let validationPipe: GlobalValidationPipe;
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: TestDto,
    data: '',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [GlobalValidationPipe],
    }).compile();

    validationPipe = moduleRef.get<GlobalValidationPipe>(GlobalValidationPipe);
  });

  it('should be defined', () => {
    expect(validationPipe).toBeDefined();
  });

  it('should validate and pass a valid DTO object', async () => {
    // Arrange
    const validInput = {
      email: 'test@example.playaplan.app',
      password: 'password123',
      name: 'Test User',
    };

    // Act
    const result = await validationPipe.transform(validInput, metadata);

    // Assert
    expect(result).toBeDefined();
    expect(result.email).toEqual('test@example.playaplan.app');
    expect(result.password).toEqual('password123');
    expect(result.name).toEqual('Test User');
  });

  it('should throw BadRequestException if object is invalid', async () => {
    // Arrange
    const invalidInput = {
      email: 'not-an-email',
      password: 'short', // too short
    };

    // Act & Assert
    await expect(
      validationPipe.transform(invalidInput, metadata)
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when undefined is provided', async () => {
    // Arrange
    const undefinedInput = undefined;

    // Act & Assert
    await expect(
      validationPipe.transform(undefinedInput, metadata)
    ).rejects.toThrow(BadRequestException);
  });

  it('should sanitize HTML in string fields', async () => {
    // Arrange
    const inputWithXss = {
      email: 'test@example.playaplan.app',
      password: 'password123',
      name: '<script>alert("XSS")</script>Test User',
    };

    // Act
    const result = await validationPipe.transform(inputWithXss, metadata);

    // Assert
    expect(result.name).not.toContain('<script>');
    expect(result.name).toEqual('Test User');
  });

  it('should sanitize HTML in nested objects', async () => {
    // Arrange
    const nestedMetadata: ArgumentMetadata = {
      type: 'body',
      metatype: NestedTestDto,
      data: '',
    };

    const nestedInputWithXss = {
      parentField: 'Parent <script>alert("XSS")</script>',
      child: {
        email: 'test@example.playaplan.app',
        password: 'password123',
        name: '<b>Bold</b> text',
      },
    };

    // Act
    const result = await validationPipe.transform(nestedInputWithXss, nestedMetadata);

    // Assert
    expect(result.parentField).not.toContain('<script>');
    expect(result.parentField).toEqual('Parent ');
    expect(result.child.name).not.toContain('<b>');
    expect(result.child.name).toEqual('Bold text');
  });

  it('should sanitize HTML in arrays', async () => {
    // Arrange
    const arrayInput = ['<script>alert("XSS")</script>', 'Normal text'];

    // Act
    const result = await validationPipe.transform(arrayInput, {
      type: 'body',
      metatype: Array,
      data: '',
    });

    // Assert
    expect(result[0]).not.toContain('<script>');
    expect(result[0]).toEqual('');
    expect(result[1]).toEqual('Normal text');
  });

  it('should return primitive values unchanged', async () => {
    // Arrange
    const numberInput = 123;

    // Act
    const result = await validationPipe.transform(numberInput, {
      type: 'param',
      metatype: Number,
      data: 'id',
    });

    // Assert
    expect(result).toEqual(123);
  });
});