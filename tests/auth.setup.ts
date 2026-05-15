import { test as setup, expect } from '@playwright/test';
import { join } from 'node:path';
import { PERSONAS, PersonaKey } from './helpers/personas';
import { loginViaUi } from './helpers/auth';
import { WEB_BASE_URL } from './helpers/env';

/**
 * Setup project: logs in once per persona via the UI and saves a storage-state
 * file under tests/.auth/<persona>.json. Spec projects depend on this and reuse
 * those files via `use.storageState`, skipping the login UI in every test.
 */

const PERSONA_KEYS = Object.keys(PERSONAS) as PersonaKey[];

for (const key of PERSONA_KEYS) {
  setup(`authenticate as ${key}`, async ({ page }) => {
    const persona = PERSONAS[key];
    await loginViaUi(page, persona.email);
    // Sanity check the dashboard loaded.
    await expect(page).toHaveURL(`${WEB_BASE_URL}/dashboard`);
    const storagePath = join('tests', '.auth', `${key}.json`);
    await page.context().storageState({ path: storagePath });
  });
}
