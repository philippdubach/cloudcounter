/**
 * Session handling using Cloudflare KV
 *
 * Sessions are used to:
 * 1. Deduplicate visitors (same session = same visitor)
 * 2. Track first visit vs return visit
 * 3. Track which paths a session has seen (for referrer attribution)
 */

import type { SessionData } from '../types';

// Session TTL: 8 hours in seconds
const SESSION_TTL = 8 * 60 * 60;

/**
 * Generate a session hash from IP and User-Agent
 * This is non-identifying: we hash the values and don't store originals
 */
export async function generateSessionHash(ip: string, userAgent: string): Promise<string> {
  const data = `${ip}|${userAgent}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random session ID (UUID v4 style)
 */
function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Set version (4) and variant (8, 9, a, or b)
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;

  const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Get or create a session, returning session info
 *
 * @param kv - KV namespace for sessions
 * @param ip - Client IP address
 * @param userAgent - User-Agent header
 * @param pathId - The path being visited
 * @returns Session ID and whether this is a first visit for this path
 */
export async function getOrCreateSession(
  kv: KVNamespace,
  ip: string,
  userAgent: string,
  pathId: number
): Promise<{ sessionId: string; firstVisit: boolean; sessionHash: string }> {
  const sessionHash = await generateSessionHash(ip, userAgent);
  const key = `session:${sessionHash}`;

  // Try to get existing session
  const existing = await kv.get<SessionData>(key, 'json');

  if (existing) {
    // Check if this path has been seen in this session
    const firstVisit = !existing.pathsSeen.includes(pathId);

    if (firstVisit) {
      // Add path to seen list and update
      existing.pathsSeen.push(pathId);
      await kv.put(key, JSON.stringify(existing), { expirationTtl: SESSION_TTL });
    }

    return {
      sessionId: existing.id,
      firstVisit,
      sessionHash
    };
  }

  // Create new session
  const newSession: SessionData = {
    id: generateSessionId(),
    pathsSeen: [pathId],
    createdAt: Date.now()
  };

  await kv.put(key, JSON.stringify(newSession), { expirationTtl: SESSION_TTL });

  return {
    sessionId: newSession.id,
    firstVisit: true,
    sessionHash
  };
}

/**
 * Check if a session exists without creating one
 */
export async function sessionExists(
  kv: KVNamespace,
  ip: string,
  userAgent: string
): Promise<boolean> {
  const sessionHash = await generateSessionHash(ip, userAgent);
  const key = `session:${sessionHash}`;
  const existing = await kv.get(key);
  return existing !== null;
}
