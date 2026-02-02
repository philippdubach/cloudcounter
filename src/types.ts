// Environment bindings
export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  SITE_NAME: string;
  DATA_RETENTION_DAYS: string;
  DASHBOARD_PASSWORD: string;
}

// Database row types
export interface Path {
  path_id: number;
  path: string;
  title: string;
  event: number;
}

export interface Ref {
  ref_id: number;
  ref: string;
  ref_scheme: string;
}

export interface Browser {
  browser_id: number;
  name: string;
  version: string;
}

export interface System {
  system_id: number;
  name: string;
  version: string;
}

export interface Hit {
  hit_id: number;
  path_id: number;
  ref_id: number;
  browser_id: number;
  system_id: number;
  session: string | null;
  first_visit: number;
  width: number | null;
  location: string;
  language: string | null;
  created_at: string;
}

export interface HitCount {
  path_id: number;
  hour: string;
  total: number;
}

export interface HitStat {
  path_id: number;
  day: string;
  stats: string; // JSON array
}

// Hit tracking input
export interface HitParams {
  p: string;       // path (required)
  t?: string;      // title
  r?: string;      // referrer
  e?: string;      // event flag ('true' or '1')
  s?: string;      // screen width
  b?: string;      // bot indicator
  q?: string;      // query string (for utm params)
  rnd?: string;    // cache buster (ignored)
}

// Processed hit ready for DB
export interface ProcessedHit {
  pathId: number;
  refId: number;
  browserId: number;
  systemId: number;
  session: string;
  firstVisit: boolean;
  width: number | null;
  location: string;
  language: string | null;
  createdAt: Date;
  hour: string;
  day: string;
}

// Session data stored in KV
export interface SessionData {
  id: string;
  pathsSeen: number[];
  createdAt: number;
}

// Dashboard query results
export interface PageStats {
  path: string;
  title: string;
  event: number;
  total: number;
}

export interface PageWithChange {
  path_id: number;
  path: string;
  title: string;
  event: number;
  total: number;
  change: number | null; // percentage change, null if no previous data
  sparkline: number[];   // daily totals for mini chart
}

export interface RefStats {
  ref: string;
  ref_scheme: string;
  total: number;
}

export interface BrowserStats {
  name: string;
  version: string;
  count: number;
}

export interface SystemStats {
  name: string;
  version: string;
  count: number;
}

export interface LocationStats {
  location: string;
  count: number;
}

export interface SizeStats {
  width: number;
  count: number;
}

export interface TimeSeriesPoint {
  time: string;
  count: number;
}

// Dashboard data
export interface DashboardData {
  siteName: string;
  start: string;
  end: string;
  period: string;
  granularity: 'hour' | 'day';
  filter: string;
  totalHits: number;
  totalHitsChange: number | null;
  totalVisitors: number;
  totalVisitorsChange: number | null;
  timeSeries: TimeSeriesPoint[];
  pages: PageWithChange[];
  hasMorePages: boolean;
  totalPagesCount: number;
  refs: RefStats[];
  browsers: BrowserStats[];
  systems: SystemStats[];
  locations: LocationStats[];
  sizes: SizeStats[];
}

// Parsed user agent
export interface ParsedUA {
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
}

// Parsed referrer
export interface ParsedRef {
  ref: string;
  scheme: 'h' | 'c' | 'g' | 'o'; // http, campaign, generated, other
}
