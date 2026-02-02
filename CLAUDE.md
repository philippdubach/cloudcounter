# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CloudCounter is a privacy-focused web analytics solution running on Cloudflare Pages with D1 (SQLite) database and KV for session storage. It's a simplified, single-site version of GoatCounter.

## Commands

```bash
npm run dev              # Local dev server with D1 and KV bindings
npm run deploy           # Deploy to Cloudflare Pages (or: wrangler pages deploy public)
npm run db:migrate       # Apply migrations to production D1
npm run db:migrate:local # Apply migrations to local D1
npm run typecheck        # TypeScript type checking
```

## Architecture

### Request Flow
1. `functions/_middleware.ts` - Auth guard (protects all routes except `/api/count` and `/login`)
2. Route handlers in `functions/` serve pages or API endpoints
3. `public/count.js` is the tracking script loaded on client sites

### Key Components

**functions/** - Cloudflare Pages Functions (serverless endpoints)
- `api/count.ts` - Hit tracking endpoint (GET/POST, returns 1x1 GIF)
- `index.ts` - Dashboard (server-rendered HTML with embedded chart data)
- `login.ts` / `logout.ts` - Cookie-based auth

**src/lib/** - Core utilities
- `session.ts` - Session management via KV (8-hour TTL, IP+UA hash)
- `refs.ts` - Referrer parsing and normalization
- `useragent.ts` - Browser/OS detection from User-Agent
- `db.ts` - D1 database helpers

**src/stats/** - Analytics logic
- `queries.ts` - Read queries for dashboard data
- `update.ts` - Write operations (store hits, update aggregates)

**public/** - Static assets served by Pages
- `count.js` - Client tracking script (auto-detects endpoint from script src URL)
- `dashboard.js` - Chart rendering (Canvas-based, supports bar/line toggle)
- `dashboard.css` - Dashboard styles

### Bindings (wrangler.toml)
- `DB` - D1 database for all analytics data
- `SESSIONS` - KV namespace for session deduplication
- `DASHBOARD_PASSWORD` - Secret for dashboard login

### Database Schema (migrations/0001_init.sql)
- Dimension tables: `paths`, `refs`, `browsers`, `systems`
- Raw data: `hits` (individual pageviews)
- Aggregates: `hit_counts` (hourly), `hit_stats` (daily), `*_stats` (dimension breakdowns)

## Tracking Script Integration

The `count.js` script auto-detects its API endpoint from its own `src` URL:
```html
<script async src="https://your-domain.com/count.js"></script>
```
This allows the same script to work across custom domains without configuration.
