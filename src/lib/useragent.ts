/**
 * User-Agent parsing
 *
 * Based on GoatCounter's gadget library
 * Handles common browsers and operating systems
 */

import type { ParsedUA } from '../types';

/**
 * Parse a User-Agent string into browser and OS information
 */
export function parseUA(ua: string): ParsedUA {
  if (!ua) {
    return { browserName: '', browserVersion: '', osName: '', osVersion: '' };
  }

  const browser = parseBrowser(ua);
  const os = parseOS(ua);

  return {
    browserName: browser.name,
    browserVersion: browser.version,
    osName: os.name,
    osVersion: os.version
  };
}

interface NameVersion {
  name: string;
  version: string;
}

/**
 * Parse browser from UA string
 */
function parseBrowser(ua: string): NameVersion {
  // Order matters: check more specific patterns first

  // Edge (Chromium-based)
  let match = ua.match(/Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'Edge', version: match[1] };
  }

  // Opera
  match = ua.match(/(?:OPR|Opera)\/(\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'Opera', version: match[1] };
  }

  // Samsung Browser
  match = ua.match(/SamsungBrowser\/(\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'Samsung Browser', version: match[1] };
  }

  // UC Browser
  match = ua.match(/UCBrowser\/(\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'UC Browser', version: match[1] };
  }

  // Brave (identifies as Chrome but with Brave in UA)
  if (ua.includes('Brave')) {
    match = ua.match(/Chrome\/(\d+(?:\.\d+)?)/);
    if (match) {
      return { name: 'Brave', version: match[1] };
    }
  }

  // Firefox
  match = ua.match(/Firefox\/(\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'Firefox', version: match[1] };
  }

  // Chrome (must be after Edge, Opera, Brave)
  match = ua.match(/Chrome\/(\d+(?:\.\d+)?)/);
  if (match && !ua.includes('Chromium')) {
    return { name: 'Chrome', version: match[1] };
  }

  // Chromium
  match = ua.match(/Chromium\/(\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'Chromium', version: match[1] };
  }

  // Safari (must be after Chrome)
  match = ua.match(/Version\/(\d+(?:\.\d+)?).*Safari/);
  if (match) {
    return { name: 'Safari', version: match[1] };
  }

  // Safari without version
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    return { name: 'Safari', version: '' };
  }

  // Internet Explorer
  match = ua.match(/(?:MSIE |rv:)(\d+(?:\.\d+)?)/);
  if (match && ua.includes('Trident')) {
    return { name: 'Internet Explorer', version: match[1] };
  }

  // Curl
  match = ua.match(/curl\/(\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'curl', version: match[1] };
  }

  // Wget
  match = ua.match(/Wget\/(\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'Wget', version: match[1] };
  }

  return { name: '', version: '' };
}

/**
 * Parse operating system from UA string
 */
function parseOS(ua: string): NameVersion {
  // iOS (must be before macOS since iPhone/iPad UAs also contain Mac OS X)
  let match = ua.match(/(?:iPhone|iPad|iPod).*OS (\d+[_\d]*)/);
  if (match) {
    return { name: 'iOS', version: match[1].replace(/_/g, '.') };
  }

  // Android
  match = ua.match(/Android (\d+(?:\.\d+)?)/);
  if (match) {
    return { name: 'Android', version: match[1] };
  }

  // Windows
  match = ua.match(/Windows NT (\d+\.\d+)/);
  if (match) {
    const version = match[1];
    const windowsVersion = windowsNTVersionMap[version] || version;
    return { name: 'Windows', version: windowsVersion };
  }

  if (ua.includes('Windows')) {
    return { name: 'Windows', version: '' };
  }

  // macOS (must be after iOS)
  match = ua.match(/Mac OS X (\d+[_\d]*)/);
  if (match) {
    return { name: 'macOS', version: match[1].replace(/_/g, '.') };
  }

  if (ua.includes('Macintosh') || ua.includes('Mac OS')) {
    return { name: 'macOS', version: '' };
  }

  // Linux distros
  if (ua.includes('Ubuntu')) {
    match = ua.match(/Ubuntu\/(\d+(?:\.\d+)?)/);
    return { name: 'Ubuntu', version: match?.[1] || '' };
  }

  if (ua.includes('Fedora')) {
    return { name: 'Fedora', version: '' };
  }

  if (ua.includes('Linux')) {
    return { name: 'Linux', version: '' };
  }

  // Chrome OS
  if (ua.includes('CrOS')) {
    return { name: 'Chrome OS', version: '' };
  }

  // FreeBSD
  if (ua.includes('FreeBSD')) {
    return { name: 'FreeBSD', version: '' };
  }

  return { name: '', version: '' };
}

// Windows NT version mapping
const windowsNTVersionMap: Record<string, string> = {
  '10.0': '10',
  '6.3': '8.1',
  '6.2': '8',
  '6.1': '7',
  '6.0': 'Vista',
  '5.1': 'XP',
  '5.0': '2000'
};

/**
 * Basic bot detection from User-Agent
 * Returns a score: 0 = not a bot, higher = more likely bot
 *
 * This is supplementary to Cloudflare's bot detection
 */
export function detectBot(ua: string): number {
  if (!ua) return 100;

  const lowerUA = ua.toLowerCase();

  // Common bot patterns
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'http',
    'curl', 'wget', 'python', 'java/', 'php/',
    'headless', 'phantom', 'selenium', 'puppeteer',
    'googlebot', 'bingbot', 'yandex', 'baidu',
    'facebookexternalhit', 'twitterbot', 'linkedinbot',
    'slackbot', 'whatsapp', 'telegram',
    'preview', 'validator', 'checker', 'monitor'
  ];

  for (const pattern of botPatterns) {
    if (lowerUA.includes(pattern)) {
      return 150;
    }
  }

  // Very short UA is suspicious
  if (ua.length < 20) {
    return 100;
  }

  // Missing common browser identifiers
  if (!lowerUA.includes('mozilla') && !lowerUA.includes('opera')) {
    return 50;
  }

  return 0;
}
