/**
 * Validates the WebAuthn (passkey) configuration at application boot.
 *
 * The browser will silently reject WebAuthn ceremonies when the relying
 * party ID does not match the page's effective domain, so we fail fast
 * with a clear error here rather than letting users see broken passkey
 * flows in production.
 *
 * Matching rule (per WebAuthn L3 §5.1.3, simplified):
 *   - rpId must equal the origin's hostname, OR
 *   - the origin's hostname must end with `.` + rpId
 *     (dot-anchored, so `evilplayaplan.app` does NOT match `playaplan.app`)
 *   - rpId must contain at least one dot OR be the literal `localhost`
 *     (prevents using a public suffix like `app` as the rpId)
 *
 * Browsers independently enforce the public-suffix list, so a misconfigured
 * RP ID that slips past this check will fail in the browser at registration
 * or authentication time. This validator is a developer-experience guard.
 */
export interface WebAuthnConfig {
  readonly rpName: string;
  readonly rpId: string;
  readonly origin: string;
}

export class WebAuthnConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebAuthnConfigError';
  }
}

/**
 * Validates a WebAuthn configuration object. Throws WebAuthnConfigError
 * with a descriptive message on any failure. Returns void on success.
 */
export function validateWebAuthnConfig(config: WebAuthnConfig): void {
  if (!config.rpName || config.rpName.trim().length === 0) {
    throw new WebAuthnConfigError('WEBAUTHN_RP_NAME must be a non-empty string');
  }
  if (!config.rpId || config.rpId.trim().length === 0) {
    throw new WebAuthnConfigError('WEBAUTHN_RP_ID must be a non-empty hostname');
  }
  let originHost: string;
  let originProtocol: string;
  try {
    const parsed = new URL(config.origin);
    originHost = parsed.hostname;
    originProtocol = parsed.protocol;
  } catch {
    throw new WebAuthnConfigError(
      `WEBAUTHN_ORIGIN is not a valid URL: ${config.origin}`,
    );
  }
  // Browsers only honor WebAuthn ceremonies in a secure context: HTTPS, or
  // localhost/127.0.0.1 over plain HTTP. Reject any non-HTTPS production
  // origin at boot so a misconfigured deploy fails fast instead of silently
  // breaking passkey login in the browser.
  const isLoopbackHost = originHost === 'localhost' || originHost === '127.0.0.1';
  if (originProtocol !== 'https:' && !isLoopbackHost) {
    throw new WebAuthnConfigError(
      `WEBAUTHN_ORIGIN must use https outside localhost (got "${config.origin}")`,
    );
  }
  if (config.rpId === 'localhost') {
    if (originHost !== 'localhost') {
      throw new WebAuthnConfigError(
        `WEBAUTHN_RP_ID is "localhost" but WEBAUTHN_ORIGIN hostname is "${originHost}"`,
      );
    }
    return;
  }
  if (isIpAddress(config.rpId)) {
    throw new WebAuthnConfigError(
      `WEBAUTHN_RP_ID "${config.rpId}" is an IP address; WebAuthn requires a domain name`,
    );
  }
  if (!config.rpId.includes('.')) {
    throw new WebAuthnConfigError(
      `WEBAUTHN_RP_ID "${config.rpId}" must contain at least one dot ` +
        `(public suffixes like "app" or "com" are not valid relying party identifiers)`,
    );
  }
  if (originHost === config.rpId) return;
  if (originHost.endsWith('.' + config.rpId)) return;
  throw new WebAuthnConfigError(
    `WEBAUTHN_RP_ID "${config.rpId}" is not a valid relying party identifier ` +
      `for origin hostname "${originHost}". RP ID must equal the origin hostname ` +
      `or be a parent domain of it (e.g., rpId "playaplan.app" is valid for ` +
      `origin "https://test.playaplan.app").`,
  );
}

const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function isIpAddress(host: string): boolean {
  if (IPV4_PATTERN.test(host)) return true;
  // IPv6 literals in URL hostnames are bracketed; URL.hostname strips them
  // but they always contain colons, which never appear in DNS hostnames.
  if (host.includes(':')) return true;
  return false;
}
