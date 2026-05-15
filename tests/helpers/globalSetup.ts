import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REUSE_DB } from './env';

/**
 * Generate a stable RUN_ID for this Playwright invocation and propagate it via env
 * to all workers. Also writes a marker file so debugging tools can find the run.
 */
export default async function globalSetup(): Promise<void> {
  if (!process.env.E2E_RUN_ID) {
    process.env.E2E_RUN_ID = `local-${Date.now().toString(36)}`;
  }
  const runId = process.env.E2E_RUN_ID;

  const authDir = join(process.cwd(), 'tests', '.auth');
  mkdirSync(authDir, { recursive: true });
  writeFileSync(join(authDir, '.run-id'), runId, 'utf8');

   
  console.log(`[e2e] RUN_ID=${runId} REUSE_DB=${REUSE_DB ? 'true' : 'false'}`);
}
