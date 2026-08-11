import { describe, expect, it } from 'vitest';
import { PATHS } from '../../routes';
import { getSafeReturnTo } from '../returnToUtils';

describe('getSafeReturnTo', () => {
  it.each([
    '/dashboard',
    '/admin/users',
    '/registration?step=2',
    '/admin/camping-options/option-1/fields',
  ])('should allow authenticated application route %s', inputReturnTo => {
    const actualReturnTo = getSafeReturnTo(inputReturnTo);

    expect(actualReturnTo).toBe(inputReturnTo);
  });

  it.each([
    null,
    '',
    'dashboard',
    'https://evil.example',
    '//evil.example',
    '\\\\evil.example',
    '/\\evil.example',
    '\\/evil.example',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '%2F%2Fevil.example',
    '%252F%252Fevil.example',
    '/%5Cevil.example',
    '/%255Cevil.example',
    '/administrator',
    '/unknown',
    '/login',
    '/dashboard#unexpected',
    ' /dashboard',
    '/dashboard ',
    '/dashboard\u0000',
    '/%E0%A4%A',
  ])('should replace unsafe return target %s with the dashboard', inputReturnTo => {
    const actualReturnTo = getSafeReturnTo(inputReturnTo);

    expect(actualReturnTo).toBe(PATHS.DASHBOARD);
  });
});
