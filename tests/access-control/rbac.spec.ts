import { test, expect } from '@playwright/test';
import { webUrl } from '../helpers/env';

function escapeRegex(s: string): string {
  return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

/**
 * RBAC matrix: for each protected route, assert each role gets the expected outcome.
 *
 * "Allowed" = page renders normally (URL stays put, expected heading shows).
 * "Denied" = either redirected to /login, /dashboard, or shown an access-denied state.
 * "Anon"   = unauthenticated user is redirected to /login.
 */

type Outcome = 'allowed' | 'denied';

interface RouteCase {
  /** Hash-route path to navigate to (without the leading `#`) */
  path: string;
  /** Heading text expected when allowed (case-insensitive) */
  heading: RegExp;
  matrix: {
    admin: Outcome;
    staff: Outcome;
    participant: Outcome;
  };
}

const ROUTES: RouteCase[] = [
  {
    path: '/dashboard',
    heading: /welcome|dashboard/i,
    matrix: { admin: 'allowed', staff: 'allowed', participant: 'allowed' },
  },
  {
    path: '/profile',
    heading: /your profile/i,
    matrix: { admin: 'allowed', staff: 'allowed', participant: 'allowed' },
  },
  {
    path: '/reports',
    heading: /reports/i,
    matrix: { admin: 'allowed', staff: 'allowed', participant: 'denied' },
  },
  {
    path: '/admin',
    heading: /admin panel/i,
    matrix: { admin: 'allowed', staff: 'denied', participant: 'denied' },
  },
  {
    path: '/admin/users',
    heading: /user management|users/i,
    matrix: { admin: 'allowed', staff: 'denied', participant: 'denied' },
  },
  {
    path: '/admin/configuration',
    heading: /config/i,
    matrix: { admin: 'allowed', staff: 'denied', participant: 'denied' },
  },
  {
    path: '/admin/manage-registrations',
    heading: /manage registrations/i,
    matrix: { admin: 'allowed', staff: 'denied', participant: 'denied' },
  },
];

async function expectAllowed(page: import('@playwright/test').Page, route: RouteCase): Promise<void> {
  await page.goto(webUrl(route.path));
  await expect(page).toHaveURL(new RegExp('#' + escapeRegex(route.path)), {
    timeout: 10_000,
  });
  await expect(page.getByRole('heading').filter({ hasText: route.heading }).first()).toBeVisible({
    timeout: 10_000,
  });
}

async function expectDenied(page: import('@playwright/test').Page, route: RouteCase): Promise<void> {
  await page.goto(webUrl(route.path));
  // App may redirect to /dashboard or /login or render an access-denied state. Any of those is acceptable.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  const url = page.url();
  // We're "denied" if we're no longer on the requested hash route.
  const stillOnRoute = url.includes(`#${route.path}`);
  if (!stillOnRoute) return;
  // If we stayed, there must be an access-denied indicator.
  const accessDenied = page.getByText(/access denied|not authorized|forbidden/i).first();
  await expect(accessDenied).toBeVisible({ timeout: 5_000 });
}

const ROLES = ['admin', 'staff', 'participant'] as const;

for (const role of ROLES) {
  test.describe(`RBAC: ${role}`, { tag: ['@rbac'] }, () => {
    test.use({ storageState: `tests/.auth/${role}.json` });

    for (const route of ROUTES) {
      const outcome = route.matrix[role];
      test(`${outcome === 'allowed' ? 'can' : 'cannot'} access ${route.path}`, async ({ page }) => {
        if (outcome === 'allowed') {
          await expectAllowed(page, route);
        } else {
          await expectDenied(page, route);
        }
      });
    }
  });
}

test.describe('RBAC: anonymous', { tag: ['@rbac'] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of ROUTES) {
    test(`unauthenticated visit to ${route.path} redirects to login`, async ({ page }) => {
      await page.goto(webUrl(route.path));
      await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
    });
  }
});
