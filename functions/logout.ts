/**
 * Logout handler
 *
 * GET /logout - Clear session and redirect to login
 */

import type { Env } from '../src/types';

const SESSION_COOKIE = 'gc_session';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Get session token from cookie
  const cookie = request.headers.get('Cookie');
  const token = parseCookie(cookie, SESSION_COOKIE);

  // Delete session from KV if exists
  if (token) {
    await env.SESSIONS.delete(`auth:${token}`);
  }

  // Clear cookie and redirect to login
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/login',
      'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    }
  });
};

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
