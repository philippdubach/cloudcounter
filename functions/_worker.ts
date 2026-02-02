/**
 * Main worker entry point
 *
 * Handles scheduled cron tasks for data cleanup
 */

import type { Env } from '../src/types';

export default {
  /**
   * Scheduled task handler (cron)
   * Runs daily at 3 AM UTC
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runDailyCleanup(env));
  }
};

/**
 * Run daily cleanup tasks
 */
async function runDailyCleanup(env: Env): Promise<void> {
  const db = env.DB;

  console.log('Starting daily cleanup...');

  try {
    // 1. Apply data retention policy
    const retentionResult = await db.prepare(`
      SELECT value FROM settings WHERE key = 'data_retention_days'
    `).first<{ value: string }>();

    const retentionDays = parseInt(retentionResult?.value || '0', 10);

    if (retentionDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays);
      const cutoff = cutoffDate.toISOString();

      // Delete old hits
      const deleteResult = await db.prepare(`
        DELETE FROM hits WHERE created_at < ?
      `).bind(cutoff).run();

      console.log(`Deleted ${deleteResult.meta.changes} old hits (retention: ${retentionDays} days)`);

      // Delete old hit_counts
      await db.prepare(`
        DELETE FROM hit_counts WHERE hour < ?
      `).bind(cutoff).run();

      // Delete old hit_stats
      const cutoffDay = cutoff.slice(0, 10);
      await db.prepare(`
        DELETE FROM hit_stats WHERE day < ?
      `).bind(cutoffDay).run();

      // Delete old ref_counts
      await db.prepare(`
        DELETE FROM ref_counts WHERE hour < ?
      `).bind(cutoff).run();

      // Delete old dimension stats
      await db.batch([
        db.prepare('DELETE FROM browser_stats WHERE day < ?').bind(cutoffDay),
        db.prepare('DELETE FROM system_stats WHERE day < ?').bind(cutoffDay),
        db.prepare('DELETE FROM location_stats WHERE day < ?').bind(cutoffDay),
        db.prepare('DELETE FROM size_stats WHERE day < ?').bind(cutoffDay),
      ]);

      console.log('Cleaned up old aggregation data');
    }

    // 2. Vacuum unused refs
    const vacuumResult = await db.prepare(`
      DELETE FROM refs
      WHERE ref_id > 1
        AND ref_id NOT IN (SELECT DISTINCT ref_id FROM ref_counts)
        AND ref_id NOT IN (SELECT DISTINCT ref_id FROM hits)
    `).run();

    console.log(`Vacuumed ${vacuumResult.meta.changes} unused refs`);

    // 3. Vacuum unused browsers
    await db.prepare(`
      DELETE FROM browsers
      WHERE browser_id > 1
        AND browser_id NOT IN (SELECT DISTINCT browser_id FROM browser_stats)
        AND browser_id NOT IN (SELECT DISTINCT browser_id FROM hits)
    `).run();

    // 4. Vacuum unused systems
    await db.prepare(`
      DELETE FROM systems
      WHERE system_id > 1
        AND system_id NOT IN (SELECT DISTINCT system_id FROM system_stats)
        AND system_id NOT IN (SELECT DISTINCT system_id FROM hits)
    `).run();

    console.log('Daily cleanup complete');

  } catch (error) {
    console.error('Daily cleanup error:', error);
    throw error;
  }
}
