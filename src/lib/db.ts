/**
 * D1 Database helpers for get-or-create operations
 */

import type { Path, Ref, Browser, System } from '../types';

/**
 * Get or create a path entry, returning the path_id
 */
export async function getOrCreatePath(
  db: D1Database,
  path: string,
  title: string = '',
  isEvent: boolean = false
): Promise<number> {
  // Try to get existing
  const existing = await db
    .prepare('SELECT path_id FROM paths WHERE path = ?')
    .bind(path)
    .first<{ path_id: number }>();

  if (existing) {
    // Update title if provided and different
    if (title) {
      await db
        .prepare('UPDATE paths SET title = ? WHERE path_id = ? AND title != ?')
        .bind(title, existing.path_id, title)
        .run();
    }
    return existing.path_id;
  }

  // Insert new
  const result = await db
    .prepare('INSERT INTO paths (path, title, event) VALUES (?, ?, ?) RETURNING path_id')
    .bind(path, title, isEvent ? 1 : 0)
    .first<{ path_id: number }>();

  return result!.path_id;
}

/**
 * Get or create a referrer entry, returning the ref_id
 */
export async function getOrCreateRef(
  db: D1Database,
  ref: string,
  scheme: string = 'o'
): Promise<number> {
  // Empty ref is always id 1 (direct/unknown)
  if (!ref) return 1;

  // Try to get existing
  const existing = await db
    .prepare('SELECT ref_id FROM refs WHERE ref = ? AND ref_scheme = ?')
    .bind(ref, scheme)
    .first<{ ref_id: number }>();

  if (existing) {
    return existing.ref_id;
  }

  // Insert new
  const result = await db
    .prepare('INSERT INTO refs (ref, ref_scheme) VALUES (?, ?) RETURNING ref_id')
    .bind(ref, scheme)
    .first<{ ref_id: number }>();

  return result!.ref_id;
}

/**
 * Get or create a browser entry, returning the browser_id
 */
export async function getOrCreateBrowser(
  db: D1Database,
  name: string,
  version: string
): Promise<number> {
  // Unknown browser is id 1
  if (!name) return 1;

  // Try to get existing
  const existing = await db
    .prepare('SELECT browser_id FROM browsers WHERE name = ? AND version = ?')
    .bind(name, version)
    .first<{ browser_id: number }>();

  if (existing) {
    return existing.browser_id;
  }

  // Insert new
  const result = await db
    .prepare('INSERT INTO browsers (name, version) VALUES (?, ?) RETURNING browser_id')
    .bind(name, version)
    .first<{ browser_id: number }>();

  return result!.browser_id;
}

/**
 * Get or create a system/OS entry, returning the system_id
 */
export async function getOrCreateSystem(
  db: D1Database,
  name: string,
  version: string
): Promise<number> {
  // Unknown system is id 1
  if (!name) return 1;

  // Try to get existing
  const existing = await db
    .prepare('SELECT system_id FROM systems WHERE name = ? AND version = ?')
    .bind(name, version)
    .first<{ system_id: number }>();

  if (existing) {
    return existing.system_id;
  }

  // Insert new
  const result = await db
    .prepare('INSERT INTO systems (name, version) VALUES (?, ?) RETURNING system_id')
    .bind(name, version)
    .first<{ system_id: number }>();

  return result!.system_id;
}

/**
 * Format a Date to ISO hour string for hit_counts
 * e.g., "2024-01-15T14:00:00Z"
 */
export function formatHour(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, 13) + ':00:00Z';
}

/**
 * Format a Date to ISO day string for hit_stats
 * e.g., "2024-01-15"
 */
export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get the hour index (0-23) from a Date
 */
export function getHourIndex(date: Date): number {
  return date.getUTCHours();
}

/**
 * Normalize screen width to bucket
 * CloudCounter uses these buckets: phone (<384), tablet (384-1024), desktop (>1024)
 * We'll just store the actual width and bucket in queries
 */
export function normalizeWidth(width: number | null): number | null {
  if (width === null || width <= 0) return null;
  // Round to nearest 100 for grouping
  return Math.round(width / 100) * 100;
}
