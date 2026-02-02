/**
 * Referrer URL cleaning and normalization
 *
 * Based on GoatCounter's ref.go
 */

import type { ParsedRef } from '../types';

// Referrer scheme types
export const REF_SCHEME_HTTP = 'h';
export const REF_SCHEME_OTHER = 'o';
export const REF_SCHEME_GENERATED = 'g';
export const REF_SCHEME_CAMPAIGN = 'c';

// Group similar referrers together
const GROUPS: Record<string, string> = {
  // Hacker News (uses referrer: origin policy)
  'news.ycombinator.com': 'Hacker News',
  'hn.algolia.com': 'Hacker News',
  'hckrnews.com': 'Hacker News',
  'hn.premii.com': 'Hacker News',
  'hackerweb.app': 'Hacker News',
  'quiethn.com': 'Hacker News',

  // Email clients
  'mail.google.com': 'Email',
  'com.google.android.gm': 'Email',
  'mail.yahoo.com': 'Email',
  'outlook.live.com': 'Email',

  // RSS readers
  'feedly.com': 'RSS',
  'www.inoreader.com': 'RSS',
  'usepanda.com': 'RSS',

  // Google app
  'com.google.android.googlequicksearchbox': 'Google',

  // Reddit apps
  'com.andrewshu.android.reddit': 'www.reddit.com',
  'com.laurencedawson.reddit_sync': 'www.reddit.com',

  // Facebook variants
  'm.facebook.com': 'www.facebook.com',
  'l.facebook.com': 'www.facebook.com',
  'lm.facebook.com': 'www.facebook.com',

  // Messaging
  'org.telegram.messenger': 'Telegram',
  'com.slack': 'Slack',

  // Baidu
  'baidu.com': 'Baidu',
  'm.baidu.com': 'Baidu',
  'www.baidu.com': 'Baidu',
  'tieba.baidu.com': 'Baidu',
};

// Host aliases (normalize mobile/old versions to main)
const HOST_ALIASES: Record<string, string> = {
  'en.m.wikipedia.org': 'en.wikipedia.org',
  'm.facebook.com': 'www.facebook.com',
  'old.reddit.com': 'www.reddit.com',
  'i.reddit.com': 'www.reddit.com',
  'np.reddit.com': 'www.reddit.com',
  'www.reddit.com': 'www.reddit.com',
};

// UTM and tracking parameters to remove
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'dclid',
  'mc_cid', 'mc_eid',
  '__cf_chl_captcha_tk__', '__cf_chl_jschl_tk__',
  'ref', 'source', 'share'
];

// Known spam referrer patterns
const SPAM_PATTERNS = [
  'semalt.com',
  'buttons-for-website.com',
  'event-tracking.com',
  'free-social-buttons.com',
  'get-free-traffic-now.com',
  'best-seo-offer.com',
  'best-seo-solution.com',
  'buy-cheap-online.info',
  'success-seo.com',
  'theguardlan.com',
  'fix-website-errors.com',
];

/**
 * Parse and clean a referrer URL
 */
export function parseRef(ref: string): ParsedRef {
  if (!ref) {
    return { ref: '', scheme: REF_SCHEME_OTHER };
  }

  // Check for spam
  const lowerRef = ref.toLowerCase();
  for (const spam of SPAM_PATTERNS) {
    if (lowerRef.includes(spam)) {
      return { ref: '', scheme: REF_SCHEME_OTHER };
    }
  }

  // Check for campaign parameters (UTM)
  if (ref.includes('utm_') || ref.includes('campaign')) {
    const cleaned = cleanRef(ref);
    return { ref: cleaned, scheme: REF_SCHEME_CAMPAIGN };
  }

  // Try to parse as URL
  let url: URL;
  try {
    // Add protocol if missing
    const refWithProtocol = ref.startsWith('http') ? ref : `https://${ref}`;
    url = new URL(refWithProtocol);
  } catch {
    // Not a valid URL, treat as other
    return { ref: ref.slice(0, 200), scheme: REF_SCHEME_OTHER };
  }

  // Clean and normalize the URL
  const cleaned = cleanRefURL(ref, url);
  const scheme = url.protocol.startsWith('http') ? REF_SCHEME_HTTP : REF_SCHEME_OTHER;

  return { ref: cleaned, scheme };
}

/**
 * Clean a referrer URL
 */
function cleanRefURL(originalRef: string, url: URL): string {
  const host = url.host.toLowerCase();

  // Apply host aliases
  const normalizedHost = HOST_ALIASES[host] || host;

  // Check for groups
  if (GROUPS[host]) {
    return GROUPS[host];
  }
  if (GROUPS[normalizedHost]) {
    return GROUPS[normalizedHost];
  }

  // Group Google domains
  if (host.startsWith('www.google.') || host.startsWith('google.')) {
    return 'Google';
  }

  // Group Yandex
  if (host.includes('yandex.')) {
    return 'Yandex';
  }

  // Group Yahoo search
  if (host.includes('search.yahoo.')) {
    return 'Yahoo';
  }

  // Group Bing
  if (host.includes('bing.com')) {
    return 'Bing';
  }

  // Group DuckDuckGo
  if (host.includes('duckduckgo.')) {
    return 'DuckDuckGo';
  }

  // Twitter/X short links - expand to search
  if (host === 't.co' && url.pathname.length > 1) {
    return `twitter.com/search?q=https://t.co${url.pathname}`;
  }

  // Lobsters - only keep /s/ paths
  if (host === 'lobste.rs' && !url.pathname.startsWith('/s/')) {
    return 'lobste.rs';
  }

  // Reddit - clean up suffixes
  if (host === 'www.reddit.com' || host === 'reddit.com') {
    let path = url.pathname;
    for (const suffix of ['/top', '/new', '/search', '.compact']) {
      if (path.endsWith(suffix)) {
        path = path.slice(0, -suffix.length);
        break;
      }
    }
    return `www.reddit.com${path}`;
  }

  // Pocket - just the domain
  if (host === 'getpocket.com' || host === 'app.getpocket.com') {
    return 'getpocket.com';
  }

  // Remove tracking parameters
  const cleaned = cleanRef(`${normalizedHost}${url.pathname}${url.search}`);

  return cleaned;
}

/**
 * Remove tracking parameters from a URL string
 */
function cleanRef(ref: string): string {
  if (!ref.includes('?')) {
    return stripProtocol(ref);
  }

  try {
    const url = new URL(ref.startsWith('http') ? ref : `https://${ref}`);

    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }

    // Reconstruct without protocol
    let result = url.host + url.pathname;
    if (url.search && url.search !== '?') {
      result += url.search;
    }

    return result;
  } catch {
    return stripProtocol(ref);
  }
}

/**
 * Strip protocol from URL
 */
function stripProtocol(ref: string): string {
  return ref.replace(/^https?:\/\//, '');
}

/**
 * Extract UTM campaign parameters from a URL
 */
export function extractCampaign(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const campaign = parsed.searchParams.get('utm_campaign');
    const source = parsed.searchParams.get('utm_source');
    const medium = parsed.searchParams.get('utm_medium');

    if (campaign || source || medium) {
      const parts = [campaign, source, medium].filter(Boolean);
      return parts.join(' / ');
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}
