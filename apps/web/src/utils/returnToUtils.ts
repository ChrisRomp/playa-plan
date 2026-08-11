import { PATHS, ROUTES } from '../routes';

const RETURN_TARGET_BASE = 'https://return-target.invalid';
const CONTROL_OR_BACKSLASH_PATTERN = /[\u0000-\u001f\u007f\\]/;
const ENCODED_PATH_SEPARATOR_PATTERN = /%(?:25)*(?:2f|5c)/i;
const AUTHENTICATED_ROUTE_PATTERNS = Object.values(ROUTES)
  .filter(route => route.requiresAuth)
  .map(route => route.path);

const matchesRoutePattern = (pathname: string, pattern: string): boolean => {
  const pathSegments = pathname.split('/').filter(Boolean);
  const patternSegments = pattern.split('/').filter(Boolean);

  return patternSegments.length === pathSegments.length
    && patternSegments.every((segment, index) =>
      segment.startsWith(':') || segment === pathSegments[index]
    );
};

const parseReturnTarget = (value: string): URL | null => {
  try {
    return new URL(value, RETURN_TARGET_BASE);
  } catch {
    return null;
  }
};

/**
 * Returns a safe authenticated application path for post-login navigation.
 */
export const getSafeReturnTo = (value: string | null): string => {
  if (
    !value
    || value !== value.trim()
    || !value.startsWith('/')
    || value.startsWith('//')
    || CONTROL_OR_BACKSLASH_PATTERN.test(value)
    || ENCODED_PATH_SEPARATOR_PATTERN.test(value)
  ) {
    return PATHS.DASHBOARD;
  }

  const targetUrl = parseReturnTarget(value);
  if (!targetUrl) {
    return PATHS.DASHBOARD;
  }

  const isAllowedRoute = AUTHENTICATED_ROUTE_PATTERNS.some(pattern =>
    matchesRoutePattern(targetUrl.pathname, pattern)
  );

  if (
    targetUrl.origin !== RETURN_TARGET_BASE
    || targetUrl.username
    || targetUrl.password
    || targetUrl.hash
    || !isAllowedRoute
  ) {
    return PATHS.DASHBOARD;
  }

  return `${targetUrl.pathname}${targetUrl.search}`;
};
