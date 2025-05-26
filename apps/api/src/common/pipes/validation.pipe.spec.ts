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
    const result = await validationPipe.transform(validInput, metadata) as TestDto;

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
    const result = await validationPipe.transform(inputWithXss, metadata) as TestDto;

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
    const result = await validationPipe.transform(nestedInputWithXss, nestedMetadata) as NestedTestDto;

    // Assert
    expect(result.parentField).not.toContain('<script>');
    expect(result.parentField).toEqual('Parent ');
    expect(result.child!.name).not.toContain('<b>');
    expect(result.child!.name).toEqual('Bold text');
  });

  it('should sanitize HTML in arrays', async () => {
    // Arrange
    const arrayInput = ['<script>alert("XSS")</script>', 'Normal text'];

    // Act
    const result = await validationPipe.transform(arrayInput, {
      type: 'body',
      metatype: Array,
      data: '',
    }) as string[];

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

  describe('HTML field sanitization', () => {
    it('should preserve allowed HTML tags in homePageBlurb field', async () => {
      // Arrange
      const htmlContent = '<p>Welcome to our camp!</p><a href="https://example.com" title="Example">Visit our site</a><strong>Important info</strong>';
      const inputWithHtml = {
        homePageBlurb: htmlContent,
      };

      // Act
      const result = await validationPipe.transform(inputWithHtml, {
        type: 'body',
        metatype: Object,
        data: '',
      }) as Record<string, unknown>;

      // Assert
      expect(result.homePageBlurb).toContain('<p>');
      expect(result.homePageBlurb).toContain('<a href="https://example.com"');
      expect(result.homePageBlurb).toContain('<strong>');
      expect(result.homePageBlurb).toContain('Welcome to our camp!');
    });

    it('should strip dangerous HTML tags from homePageBlurb field', async () => {
      // Arrange
      const dangerousHtml = '<p>Safe content</p><script>alert("XSS")</script><iframe src="evil.com"></iframe><object data="malicious.swf"></object>';
      const inputWithDangerousHtml = {
        homePageBlurb: dangerousHtml,
      };

      // Act
      const result = await validationPipe.transform(inputWithDangerousHtml, {
        type: 'body',
        metatype: Object,
        data: '',
      }) as Record<string, unknown>;

      // Assert
      expect(result.homePageBlurb).toContain('<p>Safe content</p>');
      expect(result.homePageBlurb).not.toContain('<script>');
      expect(result.homePageBlurb).not.toContain('<iframe>');
      expect(result.homePageBlurb).not.toContain('<object>');
      expect(result.homePageBlurb).not.toContain('alert("XSS")');
    });

    it('should preserve allowed HTML tags in registrationTerms field', async () => {
      // Arrange
      const termsHtml = '<h3>Terms and Conditions</h3><ul><li>Rule 1</li><li>Rule 2</li></ul><a href="/rules" aria-label="Full Rules">Read full rules</a>';
      const inputWithTerms = {
        registrationTerms: termsHtml,
      };

      // Act
      const result = await validationPipe.transform(inputWithTerms, {
        type: 'body',
        metatype: Object,
        data: '',
      }) as Record<string, unknown>;

      // Assert
      expect(result.registrationTerms).toContain('<h3>');
      expect(result.registrationTerms).toContain('<ul>');
      expect(result.registrationTerms).toContain('<li>');
      expect(result.registrationTerms).toContain('<a href="/rules"');
      expect(result.registrationTerms).toContain('aria-label="Full Rules"');
    });

    it('should preserve allowed HTML tags in campDescription field', async () => {
      // Arrange
      const descriptionHtml = '<em>Amazing</em> camp in the <strong>desert</strong>. <br>Join us for <a href="/events">events</a>!';
      const inputWithDescription = {
        campDescription: descriptionHtml,
      };

      // Act
      const result = await validationPipe.transform(inputWithDescription, {
        type: 'body',
        metatype: Object,
        data: '',
      }) as Record<string, unknown>;

      // Assert
      expect(result.campDescription).toContain('<em>Amazing</em>');
      expect(result.campDescription).toContain('<strong>desert</strong>');
      expect(result.campDescription).toContain('<br');
      expect(result.campDescription).toContain('<a href="/events">');
    });

    it('should strip all HTML from non-HTML fields', async () => {
      // Arrange
      const inputWithHtml = {
        regularField: '<p>This should be stripped</p><script>alert("XSS")</script>',
        anotherField: '<strong>Bold text</strong> and <em>italic</em>',
      };

      // Act
      const result = await validationPipe.transform(inputWithHtml, {
        type: 'body',
        metatype: Object,
        data: '',
      }) as Record<string, unknown>;

      // Assert
      expect(result.regularField).not.toContain('<p>');
      expect(result.regularField).not.toContain('<script>');
      expect(result.regularField).toEqual('This should be stripped');
      expect(result.anotherField).not.toContain('<strong>');
      expect(result.anotherField).not.toContain('<em>');
      expect(result.anotherField).toEqual('Bold text and italic');
    });

    it('should handle mixed HTML and non-HTML fields correctly', async () => {
      // Arrange
      const mixedInput = {
        homePageBlurb: '<p>Welcome!</p><a href="/info">More info</a>',
        regularField: '<script>alert("XSS")</script>Safe text',
        registrationTerms: '<h2>Rules</h2><ul><li>Be respectful</li></ul>',
        anotherRegularField: '<strong>Should be stripped</strong>',
      };

      // Act
      const result = await validationPipe.transform(mixedInput, {
        type: 'body',
        metatype: Object,
        data: '',
      }) as Record<string, unknown>;

      // Assert
      // HTML fields should preserve allowed tags
      expect(result.homePageBlurb).toContain('<p>Welcome!</p>');
      expect(result.homePageBlurb).toContain('<a href="/info">');
      expect(result.registrationTerms).toContain('<h2>Rules</h2>');
      expect(result.registrationTerms).toContain('<ul><li>');
      
      // Regular fields should have HTML stripped
      expect(result.regularField).not.toContain('<script>');
      expect(result.regularField).toEqual('Safe text');
      expect(result.anotherRegularField).not.toContain('<strong>');
      expect(result.anotherRegularField).toEqual('Should be stripped');
    });
  });
});