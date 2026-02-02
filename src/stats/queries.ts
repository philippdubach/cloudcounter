/**
 * Dashboard query functions
 *
 * Query aggregation tables for dashboard display
 */

import type {
  PageStats,
  PageWithChange,
  RefStats,
  BrowserStats,
  SystemStats,
  LocationStats,
  SizeStats,
  TimeSeriesPoint
} from '../types';

/**
 * Get total hits over time (hourly or daily based on range)
 */
export async function getTotalHits(
  db: D1Database,
  start: string,
  end: string
): Promise<{ total: number; timeSeries: TimeSeriesPoint[] }> {
  // Get hourly data
  const result = await db.prepare(`
    SELECT hour as time, SUM(total) as count
    FROM hit_counts
    WHERE hour >= ? AND hour <= ?
    GROUP BY hour
    ORDER BY hour ASC
  `).bind(start, end).all<{ time: string; count: number }>();

  const timeSeries = result.results || [];
  const total = timeSeries.reduce((sum, point) => sum + point.count, 0);

  return { total, timeSeries };
}

/**
 * Get unique visitor estimate (count distinct first visits)
 */
export async function getTotalVisitors(
  db: D1Database,
  start: string,
  end: string
): Promise<number> {
  const result = await db.prepare(`
    SELECT COUNT(*) as count
    FROM hits
    WHERE created_at >= ? AND created_at <= ? AND first_visit = 1
  `).bind(start, end).first<{ count: number }>();

  return result?.count || 0;
}

/**
 * Get top pages by hit count
 */
export async function getTopPages(
  db: D1Database,
  start: string,
  end: string,
  limit: number = 10
): Promise<PageStats[]> {
  const result = await db.prepare(`
    SELECT
      p.path,
      p.title,
      p.event,
      SUM(hc.total) as total
    FROM hit_counts hc
    JOIN paths p ON hc.path_id = p.path_id
    WHERE hc.hour >= ? AND hc.hour <= ?
    GROUP BY hc.path_id
    ORDER BY total DESC
    LIMIT ?
  `).bind(start, end, limit).all<PageStats>();

  return result.results || [];
}

/**
 * Get top referrers
 */
export async function getTopRefs(
  db: D1Database,
  start: string,
  end: string,
  limit: number = 10
): Promise<RefStats[]> {
  const result = await db.prepare(`
    SELECT
      r.ref,
      r.ref_scheme,
      SUM(rc.total) as total
    FROM ref_counts rc
    JOIN refs r ON rc.ref_id = r.ref_id
    WHERE rc.hour >= ? AND rc.hour <= ?
    GROUP BY rc.ref_id
    ORDER BY total DESC
    LIMIT ?
  `).bind(start, end, limit).all<RefStats>();

  return result.results || [];
}

/**
 * Get browser statistics
 */
export async function getBrowserStats(
  db: D1Database,
  start: string,
  end: string,
  limit: number = 10
): Promise<BrowserStats[]> {
  // Convert hour range to day range
  const startDay = start.slice(0, 10);
  const endDay = end.slice(0, 10);

  const result = await db.prepare(`
    SELECT
      b.name,
      b.version,
      SUM(bs.count) as count
    FROM browser_stats bs
    JOIN browsers b ON bs.browser_id = b.browser_id
    WHERE bs.day >= ? AND bs.day <= ?
    GROUP BY bs.browser_id
    ORDER BY count DESC
    LIMIT ?
  `).bind(startDay, endDay, limit).all<BrowserStats>();

  return result.results || [];
}

/**
 * Get system/OS statistics
 */
export async function getSystemStats(
  db: D1Database,
  start: string,
  end: string,
  limit: number = 10
): Promise<SystemStats[]> {
  const startDay = start.slice(0, 10);
  const endDay = end.slice(0, 10);

  const result = await db.prepare(`
    SELECT
      s.name,
      s.version,
      SUM(ss.count) as count
    FROM system_stats ss
    JOIN systems s ON ss.system_id = s.system_id
    WHERE ss.day >= ? AND ss.day <= ?
    GROUP BY ss.system_id
    ORDER BY count DESC
    LIMIT ?
  `).bind(startDay, endDay, limit).all<SystemStats>();

  return result.results || [];
}

/**
 * Get location statistics
 */
export async function getLocationStats(
  db: D1Database,
  start: string,
  end: string,
  limit: number = 10
): Promise<LocationStats[]> {
  const startDay = start.slice(0, 10);
  const endDay = end.slice(0, 10);

  const result = await db.prepare(`
    SELECT
      location,
      SUM(count) as count
    FROM location_stats
    WHERE day >= ? AND day <= ?
    GROUP BY location
    ORDER BY count DESC
    LIMIT ?
  `).bind(startDay, endDay, limit).all<LocationStats>();

  return result.results || [];
}

/**
 * Get screen size statistics
 */
export async function getSizeStats(
  db: D1Database,
  start: string,
  end: string
): Promise<SizeStats[]> {
  const startDay = start.slice(0, 10);
  const endDay = end.slice(0, 10);

  const result = await db.prepare(`
    SELECT
      width,
      SUM(count) as count
    FROM size_stats
    WHERE day >= ? AND day <= ?
    GROUP BY width
    ORDER BY count DESC
  `).bind(startDay, endDay).all<SizeStats>();

  return result.results || [];
}

/**
 * Parse period parameters and return start/end dates
 */
export function parsePeriod(
  searchParams: URLSearchParams
): { start: string; end: string; period: string } {
  const now = new Date();
  const periodParam = searchParams.get('period') || 'week';

  let start: Date;
  let end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  switch (periodParam) {
    case 'day':
      start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      break;
    case 'week':
      start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 7);
      start.setUTCHours(0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(now);
      start.setUTCMonth(start.getUTCMonth() - 1);
      start.setUTCHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start = new Date(now);
      start.setUTCMonth(start.getUTCMonth() - 3);
      start.setUTCHours(0, 0, 0, 0);
      break;
    case 'year':
      start = new Date(now);
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      start.setUTCHours(0, 0, 0, 0);
      break;
    case 'custom':
      const startParam = searchParams.get('start');
      const endParam = searchParams.get('end');
      start = startParam ? new Date(startParam) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = endParam ? new Date(endParam) : new Date(now);
      break;
    default:
      start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 7);
      start.setUTCHours(0, 0, 0, 0);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    period: periodParam
  };
}

/**
 * Get site name from settings
 */
export async function getSiteName(db: D1Database): Promise<string> {
  const result = await db.prepare(`
    SELECT value FROM settings WHERE key = 'site_name'
  `).first<{ value: string }>();

  return result?.value || 'Analytics';
}

/**
 * Get total hits with granularity option (hourly or daily)
 */
export async function getTotalHitsWithGranularity(
  db: D1Database,
  start: string,
  end: string,
  granularity: 'hour' | 'day' = 'hour'
): Promise<{ total: number; timeSeries: TimeSeriesPoint[] }> {
  if (granularity === 'day') {
    // Aggregate by day
    const result = await db.prepare(`
      SELECT DATE(hour) as time, SUM(total) as count
      FROM hit_counts
      WHERE hour >= ? AND hour <= ?
      GROUP BY DATE(hour)
      ORDER BY time ASC
    `).bind(start, end).all<{ time: string; count: number }>();

    const timeSeries = result.results || [];
    const total = timeSeries.reduce((sum, point) => sum + point.count, 0);
    return { total, timeSeries };
  }

  // Default: hourly
  return getTotalHits(db, start, end);
}

/**
 * Get top pages with sparklines and percentage change
 */
export async function getTopPagesWithChange(
  db: D1Database,
  start: string,
  end: string,
  limit: number = 10
): Promise<{
  pages: PageWithChange[];
  hasMore: boolean;
  totalCount: number;
}> {
  // Calculate previous period (same duration, shifted back)
  const { prevStart, prevEnd } = getPreviousPeriod(start, end);

  // Get current period pages with path_id
  const currentResult = await db.prepare(`
    SELECT
      p.path_id,
      p.path,
      p.title,
      p.event,
      SUM(hc.total) as total
    FROM hit_counts hc
    JOIN paths p ON hc.path_id = p.path_id
    WHERE hc.hour >= ? AND hc.hour <= ?
    GROUP BY hc.path_id
    ORDER BY total DESC
    LIMIT ?
  `).bind(start, end, limit + 1).all<{
    path_id: number;
    path: string;
    title: string;
    event: number;
    total: number;
  }>();

  const hasMore = (currentResult.results?.length || 0) > limit;
  const currentPages = (currentResult.results || []).slice(0, limit);
  const pathIds = currentPages.map(p => p.path_id);

  // Get total count for "X of Y shown"
  const countResult = await db.prepare(`
    SELECT COUNT(DISTINCT path_id) as count
    FROM hit_counts
    WHERE hour >= ? AND hour <= ?
  `).bind(start, end).first<{ count: number }>();
  const totalCount = countResult?.count || 0;

  // Get previous period totals for comparison
  const prevTotals = new Map<number, number>();
  if (pathIds.length > 0) {
    const placeholders = pathIds.map(() => '?').join(',');
    const prevResult = await db.prepare(`
      SELECT path_id, SUM(total) as total
      FROM hit_counts
      WHERE hour >= ? AND hour <= ? AND path_id IN (${placeholders})
      GROUP BY path_id
    `).bind(prevStart, prevEnd, ...pathIds).all<{ path_id: number; total: number }>();

    for (const row of prevResult.results || []) {
      prevTotals.set(row.path_id, row.total);
    }
  }

  // Get sparkline data (daily totals for each path)
  const sparklines = new Map<number, number[]>();
  if (pathIds.length > 0) {
    const placeholders = pathIds.map(() => '?').join(',');
    const sparkResult = await db.prepare(`
      SELECT path_id, DATE(hour) as day, SUM(total) as count
      FROM hit_counts
      WHERE hour >= ? AND hour <= ? AND path_id IN (${placeholders})
      GROUP BY path_id, DATE(hour)
      ORDER BY path_id, day
    `).bind(start, end, ...pathIds).all<{ path_id: number; day: string; count: number }>();

    // Group by path_id
    for (const row of sparkResult.results || []) {
      if (!sparklines.has(row.path_id)) {
        sparklines.set(row.path_id, []);
      }
      sparklines.get(row.path_id)!.push(row.count);
    }
  }

  // Build result with changes and sparklines
  const pages: PageWithChange[] = currentPages.map(page => {
    const prevTotal = prevTotals.get(page.path_id) || 0;
    const change = prevTotal > 0
      ? Math.round(((page.total - prevTotal) / prevTotal) * 100)
      : null;

    return {
      path_id: page.path_id,
      path: page.path,
      title: page.title,
      event: page.event,
      total: page.total,
      change,
      sparkline: sparklines.get(page.path_id) || []
    };
  });

  return { pages, hasMore, totalCount };
}

/**
 * Get total hits and visitors with comparison to previous period
 */
export async function getTotalsWithChange(
  db: D1Database,
  start: string,
  end: string
): Promise<{
  totalHits: number;
  totalHitsChange: number | null;
  totalVisitors: number;
  totalVisitorsChange: number | null;
}> {
  const { prevStart, prevEnd } = getPreviousPeriod(start, end);

  // Get current totals
  const [currentHits, currentVisitors] = await Promise.all([
    getTotalHits(db, start, end),
    getTotalVisitors(db, start, end)
  ]);

  // Get previous totals
  const [prevHits, prevVisitors] = await Promise.all([
    getTotalHits(db, prevStart, prevEnd),
    getTotalVisitors(db, prevStart, prevEnd)
  ]);

  return {
    totalHits: currentHits.total,
    totalHitsChange: prevHits.total > 0
      ? Math.round(((currentHits.total - prevHits.total) / prevHits.total) * 100)
      : null,
    totalVisitors: currentVisitors,
    totalVisitorsChange: prevVisitors > 0
      ? Math.round(((currentVisitors - prevVisitors) / prevVisitors) * 100)
      : null
  };
}

/**
 * Calculate previous period dates (same duration, shifted back)
 */
export function getPreviousPeriod(start: string, end: string): {
  prevStart: string;
  prevEnd: string;
} {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const duration = endDate.getTime() - startDate.getTime();

  const prevEndDate = new Date(startDate.getTime() - 1); // 1ms before current start
  const prevStartDate = new Date(prevEndDate.getTime() - duration);

  return {
    prevStart: prevStartDate.toISOString(),
    prevEnd: prevEndDate.toISOString()
  };
}

/**
 * Parse period with support for custom date ranges and navigation
 */
export function parsePeriodExtended(
  searchParams: URLSearchParams
): {
  start: string;
  end: string;
  period: string;
  granularity: 'hour' | 'day';
  filter: string;
} {
  const now = new Date();
  const periodParam = searchParams.get('period') || 'week';
  const filterParam = searchParams.get('filter') || '';
  const granularityParam = searchParams.get('hl') as 'hour' | 'day' || 'hour';

  // Custom date range takes precedence
  const customStart = searchParams.get('period-start');
  const customEnd = searchParams.get('period-end');

  let start: Date;
  let end: Date;

  if (customStart && customEnd) {
    start = new Date(customStart);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(customEnd);
    end.setUTCHours(23, 59, 59, 999);
  } else {
    end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);

    switch (periodParam) {
      case 'day':
        start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 7);
        start.setUTCHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 30);
        start.setUTCHours(0, 0, 0, 0);
        break;
      case 'quarter':
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 90);
        start.setUTCHours(0, 0, 0, 0);
        break;
      case 'half-year':
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 180);
        start.setUTCHours(0, 0, 0, 0);
        break;
      case 'year':
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 365);
        start.setUTCHours(0, 0, 0, 0);
        break;
      default:
        start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 7);
        start.setUTCHours(0, 0, 0, 0);
    }
  }

  // Auto-select granularity based on range if not specified
  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const granularity = granularityParam || (days <= 7 ? 'hour' : 'day');

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    period: customStart ? 'custom' : periodParam,
    granularity,
    filter: filterParam
  };
}
