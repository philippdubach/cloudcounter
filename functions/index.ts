/**
 * Dashboard page handler
 *
 * GET / - Main analytics dashboard with full GoatCounter features
 */

import type { Env, DashboardData, PageWithChange } from '../src/types';
import {
  getTopPagesWithChange,
  getTotalsWithChange,
  getTotalHitsWithGranularity,
  getTopRefs,
  getBrowserStats,
  getSystemStats,
  getLocationStats,
  getSizeStats,
  parsePeriodExtended,
  getSiteName
} from '../src/stats/queries';

// Country code to name mapping (common countries)
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
  CA: 'Canada', AU: 'Australia', NL: 'Netherlands', JP: 'Japan',
  IN: 'India', BR: 'Brazil', ES: 'Spain', IT: 'Italy', RU: 'Russia',
  CN: 'China', KR: 'South Korea', MX: 'Mexico', PL: 'Poland', SE: 'Sweden',
  CH: 'Switzerland', AT: 'Austria', BE: 'Belgium', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', PT: 'Portugal', CZ: 'Czech Republic', IE: 'Ireland', NZ: 'New Zealand',
  SG: 'Singapore', HK: 'Hong Kong', TW: 'Taiwan', IL: 'Israel', ZA: 'South Africa',
  AR: 'Argentina', CL: 'Chile', CO: 'Colombia', UA: 'Ukraine', TR: 'Turkey',
  TH: 'Thailand', VN: 'Vietnam', PH: 'Philippines', MY: 'Malaysia', ID: 'Indonesia',
};

/**
 * GET / - Main dashboard
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // Parse period parameters (extended with granularity and filter)
  const { start, end, period, granularity, filter } = parsePeriodExtended(url.searchParams);

  // Fetch all data in parallel
  const [
    siteName,
    totals,
    { timeSeries },
    pagesResult,
    refs,
    browsers,
    systems,
    locations,
    sizes
  ] = await Promise.all([
    getSiteName(env.DB),
    getTotalsWithChange(env.DB, start, end),
    getTotalHitsWithGranularity(env.DB, start, end, granularity),
    getTopPagesWithChange(env.DB, start, end, 10),
    getTopRefs(env.DB, start, end, 10),
    getBrowserStats(env.DB, start, end, 10),
    getSystemStats(env.DB, start, end, 10),
    getLocationStats(env.DB, start, end, 10),
    getSizeStats(env.DB, start, end)
  ]);

  const data: DashboardData = {
    siteName,
    start: start.slice(0, 10),
    end: end.slice(0, 10),
    period,
    granularity,
    filter,
    totalHits: totals.totalHits,
    totalHitsChange: totals.totalHitsChange,
    totalVisitors: totals.totalVisitors,
    totalVisitorsChange: totals.totalVisitorsChange,
    timeSeries,
    pages: pagesResult.pages,
    hasMorePages: pagesResult.hasMore,
    totalPagesCount: pagesResult.totalCount,
    refs,
    browsers,
    systems,
    locations,
    sizes
  };

  const html = renderDashboard(data);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
};

/**
 * Render dashboard HTML
 */
function renderDashboard(data: DashboardData): string {
  const dateRange = formatDateRange(data.start, data.end);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escapeHtml(data.siteName)} - Analytics</title>
  <link rel="stylesheet" href="/dashboard.css">
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <div class="logo">☁️ CloudCounter</div>
      <a href="/logout" class="logout-btn">Sign out</a>
    </div>
  </header>

  <main class="main">
    <form id="dashboard-form" method="GET" action="/">
      <section class="controls">
        <div class="controls-row">
          <div class="date-picker-group">
            <input type="date" name="period-start" class="date-input" value="${data.start}" />
            <span class="date-separator">–</span>
            <input type="date" name="period-end" class="date-input" value="${data.end}" />
          </div>
          <div class="filter-group">
            <input type="text" name="filter" class="filter-input" placeholder="Filter paths" value="${escapeHtml(data.filter)}" />
          </div>
        </div>

        <div class="controls-row">
          <div class="period-links">
            Last
            <a href="?period=day" class="${data.period === 'day' ? 'active' : ''}">day</a> ·
            <a href="?period=week" class="${data.period === 'week' ? 'active' : ''}">week</a> ·
            <a href="?period=month" class="${data.period === 'month' ? 'active' : ''}">month</a> ·
            <a href="?period=quarter" class="${data.period === 'quarter' ? 'active' : ''}">quarter</a> ·
            <a href="?period=half-year" class="${data.period === 'half-year' ? 'active' : ''}">half year</a> ·
            <a href="?period=year" class="${data.period === 'year' ? 'active' : ''}">year</a>
          </div>
          <div class="granularity-toggle">
            View by:
            <a href="?period-start=${data.start}&period-end=${data.end}&hl=hour" class="${data.granularity === 'hour' ? 'active' : ''}">hour</a> ·
            <a href="?period-start=${data.start}&period-end=${data.end}&hl=day" class="${data.granularity === 'day' ? 'active' : ''}">day</a>
          </div>
        </div>

        <div class="controls-row nav-row">
          <div class="period-nav">
            <span class="nav-back">
              ← back
              <a href="#" data-nav="back-day">day</a> ·
              <a href="#" data-nav="back-week">week</a> ·
              <a href="#" data-nav="back-month">month</a> ·
              <a href="#" data-nav="back-year">year</a>
            </span>
          </div>
          <div class="period-current">${dateRange}</div>
          <div class="period-nav">
            <span class="nav-forward">
              <a href="#" data-nav="forward-day">day</a> ·
              <a href="#" data-nav="forward-week">week</a> ·
              <a href="#" data-nav="forward-month">month</a> ·
              <a href="#" data-nav="forward-year">year</a>
              forward →
            </span>
          </div>
        </div>
      </section>
    </form>

    <section class="totals-section">
      <div class="totals-header">
        <h2 class="section-title">Totals</h2>
        <div class="chart-controls">
          <div class="chart-toggle">
            <button type="button" class="toggle-btn active" data-chart-type="line">Line</button>
            <button type="button" class="toggle-btn" data-chart-type="bar">Bar</button>
          </div>
          <span class="totals-count">${formatNumber(data.totalHits)} visits</span>
        </div>
      </div>
      <div class="chart-container">
        <canvas id="chart"></canvas>
      </div>
    </section>

    <section class="pages-section">
      <div class="section-header">
        <h2 class="section-title">Pages</h2>
        <span class="section-count">${data.pages.length} of ${data.totalPagesCount} shown</span>
      </div>
      <div class="pages-list" id="pages-list">
        ${renderPagesContent(data.pages)}
      </div>
      ${data.hasMorePages ? `
      <div class="show-more-container">
        <button type="button" class="show-more-btn" id="show-more-pages">Show more</button>
      </div>
      ` : ''}
    </section>

    <section class="stats-grid">
      ${renderStatsWidget('Top referrers', renderRefsContent(data.refs))}
      ${renderStatsWidget('Browsers', renderBrowsersContent(data.browsers))}
      ${renderStatsWidget('Systems', renderSystemsContent(data.systems))}
      ${renderStatsWidget('Locations', renderLocationsContent(data.locations))}
    </section>

    <section class="widgets-mobile">
      ${renderMobileWidget('Pages', data.pages.length, renderPagesContentMobile(data.pages))}
      ${renderMobileWidget('Referrers', data.refs.length, renderRefsContent(data.refs))}
      ${renderMobileWidget('Browsers', data.browsers.length, renderBrowsersContent(data.browsers))}
      ${renderMobileWidget('Systems', data.systems.length, renderSystemsContent(data.systems))}
      ${renderMobileWidget('Locations', data.locations.length, renderLocationsContent(data.locations))}
    </section>
  </main>

  <script>
    window.dashboardData = {
      chartData: ${JSON.stringify(data.timeSeries)},
      pagesData: ${JSON.stringify(data.pages.map(p => ({ id: p.path_id, sparkline: p.sparkline })))},
      start: "${data.start}",
      end: "${data.end}",
      granularity: "${data.granularity}"
    };
  </script>
  <script src="/dashboard.js"></script>
</body>
</html>`;
}

/**
 * Render stats widget
 */
function renderStatsWidget(title: string, content: string): string {
  return `<div class="stats-widget">
    <h3 class="widget-title">${title}</h3>
    <div class="widget-body">
      ${content}
    </div>
  </div>`;
}

/**
 * Render a collapsible mobile widget
 */
function renderMobileWidget(title: string, count: number, content: string): string {
  return `<details class="widget-details">
    <summary>
      <span class="widget-details-title">${title}</span>
      <span class="widget-details-count">${count}</span>
    </summary>
    <div class="widget-details-content">
      ${content}
    </div>
  </details>`;
}

/**
 * Render pages content with sparklines (desktop)
 */
function renderPagesContent(pages: PageWithChange[]): string {
  if (pages.length === 0) {
    return '<div class="empty-state">No data yet</div>';
  }

  return pages.map(page => `
    <div class="page-row" data-id="${page.path_id}" data-path="${escapeHtml(page.path)}" data-title="${escapeHtml(page.title || '')}">
      <div class="page-stats">
        <span class="page-count">${formatNumber(page.total)}</span>
        ${page.change !== null ? `<span class="change-badge ${page.change >= 0 ? 'positive' : 'negative'}">${page.change >= 0 ? '+' : ''}${page.change}%</span>` : ''}
      </div>
      <div class="page-info">
        <a href="${escapeHtml(page.path)}" target="_blank" rel="noopener" class="page-path">
          ${page.event ? '<span class="event-badge">E</span>' : ''}${escapeHtml(page.path)}
        </a>
        ${page.title ? `<span class="page-title">${escapeHtml(page.title)}</span>` : ''}
      </div>
      <div class="page-sparkline">
        <canvas class="sparkline-canvas" data-values="${page.sparkline.join(',')}" width="200" height="30"></canvas>
      </div>
    </div>
  `).join('');
}

/**
 * Render pages content for mobile (simplified, no sparklines)
 */
function renderPagesContentMobile(pages: PageWithChange[]): string {
  if (pages.length === 0) {
    return '<div class="empty-state">No data yet</div>';
  }

  return pages.map(page => `
    <div class="widget-row">
      <div class="widget-row-name">
        ${page.event ? '<span class="event-badge">E</span>' : ''}
        <a href="${escapeHtml(page.path)}" target="_blank" rel="noopener">
          ${escapeHtml(page.title || page.path)}
        </a>
      </div>
      <div class="widget-row-stats">
        <span class="widget-row-count">${formatNumber(page.total)}</span>
        ${page.change !== null ? `<span class="change-badge-sm ${page.change >= 0 ? 'positive' : 'negative'}">${page.change >= 0 ? '+' : ''}${page.change}%</span>` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Render referrers content
 */
function renderRefsContent(refs: DashboardData['refs']): string {
  if (refs.length === 0) {
    return '<div class="empty-state">No data yet</div>';
  }

  const total = refs.reduce((sum, r) => sum + r.total, 0);

  return refs.map(ref => {
    const displayRef = ref.ref || '(direct)';
    const isUrl = ref.ref_scheme === 'h' && ref.ref;
    const percent = total > 0 ? ((ref.total / total) * 100) : 0;
    return `
      <div class="stat-row">
        <span class="stat-percent">${percent.toFixed(0)}%</span>
        <div class="stat-bar"><div class="stat-bar-fill" style="width: ${percent}%"></div></div>
        <span class="stat-name">
          ${isUrl
            ? `<a href="https://${escapeHtml(ref.ref)}" target="_blank" rel="noopener nofollow">${escapeHtml(displayRef)}</a>`
            : escapeHtml(displayRef)}
        </span>
        <span class="stat-count">${formatNumber(ref.total)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Render browsers content
 */
function renderBrowsersContent(browsers: DashboardData['browsers']): string {
  if (browsers.length === 0) {
    return '<div class="empty-state">No data yet</div>';
  }

  const total = browsers.reduce((sum, b) => sum + b.count, 0);

  return browsers.map(browser => {
    const name = browser.name || 'Unknown';
    const percent = total > 0 ? ((browser.count / total) * 100) : 0;
    return `
      <div class="stat-row">
        <span class="stat-percent">${percent.toFixed(0)}%</span>
        <div class="stat-bar"><div class="stat-bar-fill" style="width: ${percent}%"></div></div>
        <span class="stat-name">${escapeHtml(name)}</span>
        <span class="stat-count">${formatNumber(browser.count)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Render systems content
 */
function renderSystemsContent(systems: DashboardData['systems']): string {
  if (systems.length === 0) {
    return '<div class="empty-state">No data yet</div>';
  }

  const total = systems.reduce((sum, s) => sum + s.count, 0);

  return systems.map(system => {
    const name = system.name || 'Unknown';
    const percent = total > 0 ? ((system.count / total) * 100) : 0;
    return `
      <div class="stat-row">
        <span class="stat-percent">${percent.toFixed(0)}%</span>
        <div class="stat-bar"><div class="stat-bar-fill" style="width: ${percent}%"></div></div>
        <span class="stat-name">${escapeHtml(name)}</span>
        <span class="stat-count">${formatNumber(system.count)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Render locations content
 */
function renderLocationsContent(locations: DashboardData['locations']): string {
  if (locations.length === 0) {
    return '<div class="empty-state">No data yet</div>';
  }

  const total = locations.reduce((sum, l) => sum + l.count, 0);

  return locations.map(loc => {
    const name = COUNTRY_NAMES[loc.location] || loc.location || 'Unknown';
    const percent = total > 0 ? ((loc.count / total) * 100) : 0;
    return `
      <div class="stat-row">
        <span class="stat-percent">${percent.toFixed(0)}%</span>
        <div class="stat-bar"><div class="stat-bar-fill" style="width: ${percent}%"></div></div>
        <span class="stat-name">${escapeHtml(name)}</span>
        <span class="stat-count">${formatNumber(loc.count)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Format number with thousand separators
 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format date range for display
 */
function formatDateRange(start: string, end: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  try {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const startMonth = months[startDate.getMonth()];
    const startDay = startDate.getDate();
    const endMonth = months[endDate.getMonth()];
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();

    if (start === end) {
      return `${startMonth} ${startDay}, ${year}`;
    }

    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startMonth} ${startDay}–${endDay}, ${year}`;
    }

    if (startDate.getFullYear() === endDate.getFullYear()) {
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
    }

    return `${startMonth} ${startDay}, ${startDate.getFullYear()} – ${endMonth} ${endDay}, ${year}`;
  } catch {
    return `${start} – ${end}`;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
