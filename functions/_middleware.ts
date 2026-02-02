/**
 * Authentication middleware
 *
 * Protects dashboard routes with HTTP Basic Auth or session cookie
 */

import type { Env } from '../src/types';

// Session cookie name
const SESSION_COOKIE = 'gc_session';

// Session TTL: 7 days
const SESSION_TTL = 7 * 24 * 60 * 60;

// Public paths that don't require auth
const PUBLIC_PATHS = [
  '/api/count',
  '/count.js',
  '/login',
  '/favicon.ico',
];

// Static asset extensions
const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.gif', '.ico', '.svg', '.woff', '.woff2'];

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Allow public paths
  if (isPublicPath(url.pathname)) {
    return next();
  }

  // Allow static assets
  if (isStaticAsset(url.pathname)) {
    return next();
  }

  // Check for valid session cookie
  const cookie = request.headers.get('Cookie');
  const sessionToken = parseCookie(cookie, SESSION_COOKIE);

  if (sessionToken) {
    const isValid = await validateSession(env.SESSIONS, sessionToken);
    if (isValid) {
      return next();
    }
  }

  // Check for HTTP Basic Auth
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const isValid = validateBasicAuth(authHeader, env.DASHBOARD_PASSWORD);
    if (isValid) {
      // Create session and set cookie
      const newSession = await createSession(env.SESSIONS);
      const response = await next();

      // Clone response and add cookie
      const newResponse = new Response(response.body, response);
      newResponse.headers.append(
        'Set-Cookie',
        `${SESSION_COOKIE}=${newSession}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`
      );

      return newResponse;
    }
  }

  // No valid auth - redirect to login or prompt for Basic Auth
  if (url.pathname === '/' || url.pathname.startsWith('/dashboard')) {
    // For dashboard, redirect to login page
    return Response.redirect(new URL('/login', url.origin).toString(), 302);
  }

  // For API routes, return 401 with Basic Auth challenge
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="CloudCounter"',
      'Content-Type': 'text/plain'
    }
  });
};

/**
 * Check if path is public
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Check if path is a static asset
 */
function isStaticAsset(pathname: string): boolean {
  return STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext));
}

/**
 * Parse a cookie value from Cookie header
 */
function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [cookieName, ...cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return cookieValue.join('=');
    }
  }

  return null;
}

/**
 * Validate HTTP Basic Auth
 */
function validateBasicAuth(authHeader: string, password: string): boolean {
  if (!password) return false;

  try {
    const [scheme, credentials] = authHeader.split(' ');
    if (scheme.toLowerCase() !== 'basic') return false;

    const decoded = atob(credentials);
    const [, providedPassword] = decoded.split(':');

    return providedPassword === password;
  } catch {
    return false;
  }
}

/**
 * Validate session token in KV
 */
async function validateSession(kv: KVNamespace, token: string): Promise<boolean> {
  const session = await kv.get(`auth:${token}`);
  return session !== null;
}

/**
 * Create a new session and store in KV
 */
async function createSession(kv: KVNamespace): Promise<string> {
  const token = generateToken();
  await kv.put(`auth:${token}`, Date.now().toString(), { expirationTtl: SESSION_TTL });
  return token;
}

/**
 * Generate a random session token
 */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
