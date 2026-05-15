import { request, APIRequestContext } from '@playwright/test';
import { API_BASE_URL, DEV_LOGIN_CODE } from './env';

export interface ApiClient {
  context: APIRequestContext;
  token: string | null;
  dispose: () => Promise<void>;
}

/**
 * Create an APIRequestContext authenticated as the given email using the dev-mode
 * email-code login flow (no SMTP required; code is always 123456 in development).
 */
export async function createAuthedApiClient(email: string): Promise<ApiClient> {
  const context = await request.newContext({ baseURL: API_BASE_URL });

  const requestRes = await context.post('/auth/request-login-code', { data: { email } });
  if (!requestRes.ok()) {
    await context.dispose();
    throw new Error(
      `request-login-code failed for ${email}: ${requestRes.status()} ${await requestRes.text()}`,
    );
  }

  const loginRes = await context.post('/auth/login-with-code', {
    data: { email, code: DEV_LOGIN_CODE },
  });
  if (!loginRes.ok()) {
    await context.dispose();
    throw new Error(
      `login-with-code failed for ${email}: ${loginRes.status()} ${await loginRes.text()}`,
    );
  }

  const body = (await loginRes.json()) as { accessToken?: string; access_token?: string };
  const token = body.accessToken ?? body.access_token ?? null;
  if (!token) {
    await context.dispose();
    throw new Error(`login-with-code response missing access token: ${JSON.stringify(body)}`);
  }

  // Recreate the context with the bearer header attached for all subsequent calls.
  await context.dispose();
  const authedContext = await request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  return {
    context: authedContext,
    token,
    dispose: () => authedContext.dispose(),
  };
}

/** Anonymous API client (no auth). Useful for health checks and the initial code-request call. */
export async function createAnonApiClient(): Promise<ApiClient> {
  const context = await request.newContext({ baseURL: API_BASE_URL });
  return { context, token: null, dispose: () => context.dispose() };
}
