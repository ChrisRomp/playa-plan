import { cleanupRunData, disconnectPrisma } from './db';

export default async function globalTeardown(): Promise<void> {
  console.log('[e2e] running global teardown / cleanup');
  await cleanupRunData();
  await disconnectPrisma();
}
