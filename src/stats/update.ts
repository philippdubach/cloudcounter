/**
 * Stats update functions
 *
 * Updates all aggregation tables when a hit is recorded
 */

import type { ProcessedHit } from '../types';

/**
 * Update all stats tables for a processed hit
 * Uses D1 batch for atomic updates
 */
export async function updateStats(
  db: D1Database,
  hit: ProcessedHit
): Promise<void> {
  const statements: D1PreparedStatement[] = [];

  // 1. Insert raw hit
  statements.push(
    db.prepare(`
      INSERT INTO hits (path_id, ref_id, browser_id, system_id, session, first_visit, width, location, language, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      hit.pathId,
      hit.refId,
      hit.browserId,
      hit.systemId,
      hit.session,
      hit.firstVisit ? 1 : 0,
      hit.width,
      hit.location,
      hit.language,
      hit.createdAt.toISOString()
    )
  );

  // 2. Update hit_counts (hourly aggregation)
  statements.push(
    db.prepare(`
      INSERT INTO hit_counts (path_id, hour, total)
      VALUES (?, ?, 1)
      ON CONFLICT(path_id, hour) DO UPDATE SET total = total + 1
    `).bind(hit.pathId, hit.hour)
  );

  // 3. Update hit_stats (daily with hourly breakdown)
  const hourIndex = hit.createdAt.getUTCHours();
  statements.push(
    db.prepare(`
      INSERT INTO hit_stats (path_id, day, stats)
      VALUES (?, ?, ?)
      ON CONFLICT(path_id, day) DO UPDATE SET
        stats = json_replace(
          stats,
          '$[' || ? || ']',
          COALESCE(json_extract(stats, '$[' || ? || ']'), 0) + 1
        )
    `).bind(
      hit.pathId,
      hit.day,
      JSON.stringify(createHourlyArray(hourIndex)),
      hourIndex,
      hourIndex
    )
  );

  // Only update dimension stats on first visit to avoid inflating numbers
  if (hit.firstVisit) {
    // 4. Update ref_counts (only count referrer on first visit)
    if (hit.refId > 1) { // Skip empty referrer (id=1)
      statements.push(
        db.prepare(`
          INSERT INTO ref_counts (path_id, ref_id, hour, total)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(path_id, ref_id, hour) DO UPDATE SET total = total + 1
        `).bind(hit.pathId, hit.refId, hit.hour)
      );
    }

    // 5. Update browser_stats
    if (hit.browserId > 1) { // Skip unknown browser
      statements.push(
        db.prepare(`
          INSERT INTO browser_stats (path_id, browser_id, day, count)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(path_id, browser_id, day) DO UPDATE SET count = count + 1
        `).bind(hit.pathId, hit.browserId, hit.day)
      );
    }

    // 6. Update system_stats
    if (hit.systemId > 1) { // Skip unknown system
      statements.push(
        db.prepare(`
          INSERT INTO system_stats (path_id, system_id, day, count)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(path_id, system_id, day) DO UPDATE SET count = count + 1
        `).bind(hit.pathId, hit.systemId, hit.day)
      );
    }

    // 7. Update location_stats
    if (hit.location) {
      statements.push(
        db.prepare(`
          INSERT INTO location_stats (path_id, day, location, count)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(path_id, day, location) DO UPDATE SET count = count + 1
        `).bind(hit.pathId, hit.day, hit.location)
      );
    }

    // 8. Update size_stats
    if (hit.width !== null && hit.width > 0) {
      statements.push(
        db.prepare(`
          INSERT INTO size_stats (path_id, day, width, count)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(path_id, day, width) DO UPDATE SET count = count + 1
        `).bind(hit.pathId, hit.day, hit.width)
      );
    }
  }

  // Execute all updates in a batch
  await db.batch(statements);
}

/**
 * Create an hourly array with 1 at the given hour index
 */
function createHourlyArray(hourIndex: number): number[] {
  const arr = new Array(24).fill(0);
  arr[hourIndex] = 1;
  return arr;
}

/**
 * Update first_hit_at setting if not set
 */
export async function updateFirstHit(db: D1Database): Promise<void> {
  await db.prepare(`
    UPDATE settings
    SET value = datetime('now')
    WHERE key = 'first_hit_at' AND value IS NULL
  `).run();
}
