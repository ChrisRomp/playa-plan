import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Runs a cleanup after each test case to remove components from the DOM
afterEach(() => {
  cleanup();
});

// Extends Vitest's expect with testing-library's matchers
expect.extend({}); 