/**
 * Hit tracking endpoint
 *
 * POST /api/count or GET /api/count
 *
 * Receives pageview hits from the tracking script
 * and updates all stats tables
 */

import type { Env, HitParams, ProcessedHit } from '../../src/types';
import { getOrCreatePath, getOrCreateRef, getOrCreateBrowser, getOrCreateSystem, formatHour, formatDay, normalizeWidth } from '../../src/lib/db';
import { getOrCreateSession } from '../../src/lib/session';
import { parseUA, detectBot } from '../../src/lib/useragent';
import { parseRef } from '../../src/lib/refs';
import { updateStats, updateFirstHit } from '../../src/stats/update';

// 1x1 transparent GIF (43 bytes)
const GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

// Response headers for the tracking pixel
const RESPONSE_HEADERS = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handle OPTIONS preflight request
 */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: RESPONSE_HEADERS
  });
};

/**
 * Handle GET request (for image tracking)
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleCount(context);
};

/**
 * Handle POST request (for sendBeacon)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleCount(context);
};

/**
 * Main hit tracking handler
 */
async function handleCount(context: EventContext<Env, string, unknown>): Promise<Response> {
  const { request, env } = context;

  try {
    // Parse parameters from URL
    const url = new URL(request.url);
    const params = parseParams(url.searchParams);

    // Validate required fields
    if (!params.p) {
      return gifResponse();
    }

    // Path length limit
    if (params.p.length > 2048) {
      return gifResponse();
    }

    // Bot detection
    const userAgent = request.headers.get('User-Agent') || '';
    const clientBot = parseInt(params.b || '0', 10);
    const serverBot = detectBot(userAgent);

    // Skip if bot detected (client-side or server-side)
    if (clientBot > 0 || serverBot > 100) {
      return gifResponse();
    }

    // Cloudflare bot score (if available)
    const cf = request.cf as { botManagement?: { score?: number } } | undefined;
    if (cf?.botManagement?.score !== undefined && cf.botManagement.score < 30) {
      return gifResponse();
    }

    // Get client IP
    const ip = request.headers.get('CF-Connecting-IP') ||
               request.headers.get('X-Forwarded-For')?.split(',')[0] ||
               '0.0.0.0';

    // Process the hit asynchronously
    context.waitUntil(processHit(env, params, ip, userAgent, request));

  } catch (error) {
    console.error('Hit tracking error:', error);
  }

  return gifResponse();
}

/**
 * Parse hit parameters from query string
 */
function parseParams(searchParams: URLSearchParams): HitParams {
  return {
    p: searchParams.get('p') || '',
    t: searchParams.get('t') || undefined,
    r: searchParams.get('r') || undefined,
    e: searchParams.get('e') || undefined,
    s: searchParams.get('s') || undefined,
    b: searchParams.get('b') || undefined,
    q: searchParams.get('q') || undefined,
    rnd: searchParams.get('rnd') || undefined,
  };
}

/**
 * Process a hit and update all stats
 */
async function processHit(
  env: Env,
  params: HitParams,
  ip: string,
  userAgent: string,
  request: Request
): Promise<void> {
  const db = env.DB;
  const kv = env.SESSIONS;

  // Parse user agent
  const ua = parseUA(userAgent);

  // Parse referrer
  const refData = parseRef(params.r || '');

  // Clean path
  const path = cleanPath(params.p);
  const title = params.t || '';
  const isEvent = params.e === 'true' || params.e === '1';

  // Get or create dimension IDs
  const [pathId, refId, browserId, systemId] = await Promise.all([
    getOrCreatePath(db, path, title, isEvent),
    getOrCreateRef(db, refData.ref, refData.scheme),
    getOrCreateBrowser(db, ua.browserName, ua.browserVersion),
    getOrCreateSystem(db, ua.osName, ua.osVersion),
  ]);

  // Get or create session
  const session = await getOrCreateSession(kv, ip, userAgent, pathId);

  // Get location from Cloudflare
  const cf = request.cf as { country?: string } | undefined;
  const location = cf?.country || '';

  // Parse screen width
  const width = normalizeWidth(params.s ? parseInt(params.s, 10) : null);

  // Get language from Accept-Language header
  const acceptLanguage = request.headers.get('Accept-Language');
  const language = parseLanguage(acceptLanguage);

  // Create processed hit
  const now = new Date();
  const hit: ProcessedHit = {
    pathId,
    refId,
    browserId,
    systemId,
    session: session.sessionHash,
    firstVisit: session.firstVisit,
    width,
    location,
    language,
    createdAt: now,
    hour: formatHour(now),
    day: formatDay(now),
  };

  // Update all stats
  await updateStats(db, hit);

  // Update first_hit_at if this is the first hit ever
  if (session.firstVisit) {
    await updateFirstHit(db);
  }
}

/**
 * Clean and normalize a path
 */
function cleanPath(path: string): string {
  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Remove tracking parameters from query string
  const queryIndex = path.indexOf('?');
  if (queryIndex === -1) {
    return path;
  }

  const basePath = path.slice(0, queryIndex);
  const query = path.slice(queryIndex + 1);

  // Parse and filter query params
  const params = new URLSearchParams(query);
  const trackingParams = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'ref', '_ga'
  ];

  for (const param of trackingParams) {
    params.delete(param);
  }

  const cleanQuery = params.toString();
  return cleanQuery ? `${basePath}?${cleanQuery}` : basePath;
}

/**
 * Parse primary language from Accept-Language header
 */
function parseLanguage(header: string | null): string | null {
  if (!header) return null;

  // Get first language code
  const match = header.match(/^([a-zA-Z]{2,3})(?:-[a-zA-Z]{2})?/);
  if (match) {
    return match[1].toLowerCase();
  }

  return null;
}

/**
 * Return the tracking GIF response
 */
function gifResponse(): Response {
  return new Response(GIF, {
    status: 200,
    headers: RESPONSE_HEADERS
  });
}
