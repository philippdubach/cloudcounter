-- CloudCounter for Cloudflare D1
-- Simplified single-site schema

-- Normalized dimension tables
CREATE TABLE IF NOT EXISTS paths (
    path_id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    event INTEGER NOT NULL DEFAULT 0,
    UNIQUE(path)
);
CREATE INDEX IF NOT EXISTS idx_paths_path ON paths(path);

CREATE TABLE IF NOT EXISTS refs (
    ref_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT NOT NULL,
    ref_scheme TEXT NOT NULL DEFAULT 'o', -- 'h'=http, 'c'=campaign, 'g'=generated, 'o'=other
    UNIQUE(ref, ref_scheme)
);
-- Insert default "direct/unknown" referrer
INSERT OR IGNORE INTO refs (ref_id, ref, ref_scheme) VALUES (1, '', 'o');

CREATE TABLE IF NOT EXISTS browsers (
    browser_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '',
    UNIQUE(name, version)
);
-- Insert unknown browser
INSERT OR IGNORE INTO browsers (browser_id, name, version) VALUES (1, '', '');

CREATE TABLE IF NOT EXISTS systems (
    system_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '',
    UNIQUE(name, version)
);
-- Insert unknown system
INSERT OR IGNORE INTO systems (system_id, name, version) VALUES (1, '', '');

-- Raw hits table (for data export, apply retention policy)
CREATE TABLE IF NOT EXISTS hits (
    hit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    path_id INTEGER NOT NULL REFERENCES paths(path_id),
    ref_id INTEGER NOT NULL DEFAULT 1 REFERENCES refs(ref_id),
    browser_id INTEGER NOT NULL DEFAULT 1 REFERENCES browsers(browser_id),
    system_id INTEGER NOT NULL DEFAULT 1 REFERENCES systems(system_id),
    session TEXT,  -- Session hash (hex string)
    first_visit INTEGER NOT NULL DEFAULT 0,
    width INTEGER,
    location TEXT NOT NULL DEFAULT '',  -- ISO 3166-1 alpha-2 country code
    language TEXT,
    created_at TEXT NOT NULL  -- ISO8601 datetime
);
CREATE INDEX IF NOT EXISTS idx_hits_created_at ON hits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hits_path_id ON hits(path_id);

-- Aggregation tables (pre-computed for fast dashboard queries)

-- Hourly hit counts by path
CREATE TABLE IF NOT EXISTS hit_counts (
    path_id INTEGER NOT NULL REFERENCES paths(path_id),
    hour TEXT NOT NULL,  -- ISO8601 hour: '2024-01-15T14:00:00Z'
    total INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (path_id, hour)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_hit_counts_hour ON hit_counts(hour DESC);

-- Daily hit stats with hourly breakdown (JSON array)
CREATE TABLE IF NOT EXISTS hit_stats (
    path_id INTEGER NOT NULL REFERENCES paths(path_id),
    day TEXT NOT NULL,  -- ISO date: '2024-01-15'
    stats TEXT NOT NULL DEFAULT '[]',  -- JSON array [h0, h1, ..., h23]
    PRIMARY KEY (path_id, day)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_hit_stats_day ON hit_stats(day DESC);

-- Referrer counts
CREATE TABLE IF NOT EXISTS ref_counts (
    path_id INTEGER NOT NULL REFERENCES paths(path_id),
    ref_id INTEGER NOT NULL REFERENCES refs(ref_id),
    hour TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (path_id, ref_id, hour)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_ref_counts_hour ON ref_counts(hour DESC);

-- Browser stats by day
CREATE TABLE IF NOT EXISTS browser_stats (
    path_id INTEGER NOT NULL REFERENCES paths(path_id),
    browser_id INTEGER NOT NULL REFERENCES browsers(browser_id),
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (path_id, browser_id, day)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_browser_stats_day ON browser_stats(day DESC);

-- System/OS stats by day
CREATE TABLE IF NOT EXISTS system_stats (
    path_id INTEGER NOT NULL REFERENCES paths(path_id),
    system_id INTEGER NOT NULL REFERENCES systems(system_id),
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (path_id, system_id, day)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_system_stats_day ON system_stats(day DESC);

-- Location stats by day
CREATE TABLE IF NOT EXISTS location_stats (
    path_id INTEGER NOT NULL REFERENCES paths(path_id),
    day TEXT NOT NULL,
    location TEXT NOT NULL,  -- ISO 3166-1 alpha-2 country code
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (path_id, day, location)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_location_stats_day ON location_stats(day DESC);

-- Screen size stats by day
CREATE TABLE IF NOT EXISTS size_stats (
    path_id INTEGER NOT NULL REFERENCES paths(path_id),
    day TEXT NOT NULL,
    width INTEGER NOT NULL,  -- Screen width bucket
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (path_id, day, width)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_size_stats_day ON size_stats(day DESC);

-- Settings/metadata
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('first_hit_at', NULL),
    ('data_retention_days', '0'),  -- 0 = unlimited
    ('site_name', 'My Analytics');
