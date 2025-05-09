import { IsUrlOrRelativePath } from './is-url-or-relative-path.validator';
import { validate } from 'class-validator';

// Define a test class that uses our validator
class TestClass {
  @IsUrlOrRelativePath()
  url: string;

  constructor(url: string) {
    this.url = url;
  }
}

describe('IsUrlOrRelativePath', () => {
  it('should pass validation for absolute URLs', async () => {
    const testCases = [
      'https://example.com',
      'http://localhost:3000',
      'https://example.com/path/to/resource',
      'http://example.com/path?query=string#fragment'
    ];

    for (const testUrl of testCases) {
      const testObj = new TestClass(testUrl);
      const errors = await validate(testObj);
      expect(errors.length).toBe(0);
    }
  });

  it('should pass validation for relative paths starting with /', async () => {
    const testCases = [
      '/path/to/resource',
      '/images/banner.png',
      '/icons/icon.png',
      '/styles/main.css?v=123'
    ];

    for (const testUrl of testCases) {
      const testObj = new TestClass(testUrl);
      const errors = await validate(testObj);
      expect(errors.length).toBe(0);
    }
  });

  it('should fail validation for invalid URLs and paths', async () => {
    const testCases = [
      'path/without/leading/slash',
      'http:/missing-colon.com',
      'ftp:only-scheme',
      'just text with spaces',
      '://invalid-url-format',
      ' /space-before-slash',
      '#fragment-only'
    ];

    for (const testUrl of testCases) {
      const testObj = new TestClass(testUrl);
      const errors = await validate(testObj);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isUrlOrRelativePath');
    }
  });

  it('should pass validation for empty values', async () => {
    const testCases = ['', null, undefined];

    for (const testUrl of testCases) {
      const testObj = new TestClass(testUrl as unknown as string);
      const errors = await validate(testObj);
      expect(errors.length).toBe(0);
    }
  });
}); 