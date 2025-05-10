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
    // Test each case individually
    const invalidUrls = [
      { value: 'path/without/leading/slash', reason: 'missing leading slash' },
      { value: 'http:/missing-colon.com', reason: 'invalid URL format' },
      { value: 'ftp:only-scheme', reason: 'missing hostname' },
      { value: 'just text with spaces', reason: 'not a URL or path' },
      { value: '://invalid-url-format', reason: 'missing protocol' },
      { value: ' /space-before-slash', reason: 'space before slash' },
      { value: '#fragment-only', reason: 'fragment only, not a URL' }
    ];

    for (const { value } of invalidUrls) {
      const testObj = new TestClass(value);
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