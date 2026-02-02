/**
 * CloudCounter tracking script
 *
 * Lightweight pageview tracking for Cloudflare deployment
 * Based on CloudCounter's count.js
 *
 * Usage:
 *   <script async src="/count.js"></script>
 *
 * Manual tracking:
 *   cloudcounter.count({ path: '/custom-path', title: 'Custom Title' })
 *
 * Event tracking:
 *   cloudcounter.count({ path: 'signup-click', title: 'Signup Button', event: true })
 */
;(function() {
  'use strict';

  // Don't run twice
  if (window.cloudcounter && window.cloudcounter.loaded) return;

  var cloudcounter = window.cloudcounter || {};
  cloudcounter.loaded = true;

  // Auto-detect endpoint from script source URL
  var endpoint = (function() {
    // Use document.currentScript (the script currently being executed)
    var script = document.currentScript;
    if (script && script.src) {
      var url = new URL(script.src);
      return url.origin + '/api/count';
    }
    // Fallback to relative path if script not found
    return '/api/count';
  })();

  /**
   * Get pageview data
   */
  function getData(vars) {
    vars = vars || {};

    var data = {
      p: vars.path || getPath(),
      t: vars.title || document.title,
      r: vars.referrer || getReferrer(),
      e: vars.event ? 1 : 0,
      s: screen.width,
      b: isBot(),
      rnd: Math.random().toString(36).substr(2, 5)
    };

    return data;
  }

  /**
   * Get current path (with canonical support)
   */
  function getPath() {
    var loc = location;

    // Check for canonical link
    var canonical = document.querySelector('link[rel="canonical"][href]');
    if (canonical) {
      var a = document.createElement('a');
      a.href = canonical.href;

      // Only use canonical if same host
      if (a.hostname.replace(/^www\./, '') === loc.hostname.replace(/^www\./, '')) {
        loc = a;
      }
    }

    return (loc.pathname + loc.search) || '/';
  }

  /**
   * Get referrer (excluding self-referrals)
   */
  function getReferrer() {
    var ref = document.referrer;
    if (!ref) return '';

    try {
      var refUrl = new URL(ref);
      // Skip self-referrals
      if (refUrl.hostname === location.hostname) {
        return '';
      }
      return ref;
    } catch (e) {
      return ref;
    }
  }

  /**
   * Basic bot detection
   * Returns 0 for likely human, >0 for likely bot
   */
  function isBot() {
    var w = window;
    var d = document;

    // PhantomJS
    if (w.callPhantom || w._phantom || w.phantom) return 150;

    // Nightmare
    if (w.__nightmare) return 151;

    // Selenium/WebDriver
    if (d.__selenium_unwrapped || d.__webdriver_evaluate || d.__driver_evaluate) return 152;
    if (navigator.webdriver) return 153;

    // Headless Chrome
    if (/HeadlessChrome/.test(navigator.userAgent)) return 154;

    return 0;
  }

  /**
   * Encode data as URL query string
   */
  function urlencode(obj) {
    var p = [];
    for (var k in obj) {
      if (obj[k] !== '' && obj[k] !== null && obj[k] !== undefined && obj[k] !== false) {
        p.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
      }
    }
    return '?' + p.join('&');
  }

  /**
   * Check if we should skip this pageview
   */
  function filter() {
    // Skip prerendered pages
    if (document.visibilityState === 'prerender') return true;

    // Skip frames (only track main window)
    try {
      if (window.location !== window.parent.location) return true;
    } catch (e) {
      // Cross-origin frame - skip
      return true;
    }

    // Skip localhost
    if (/^localhost$|^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\./.test(location.hostname)) {
      return true;
    }

    // Skip if user has set skip flag
    try {
      if (localStorage.getItem('cloudcounter-skip') === 'true') return true;
    } catch (e) {}

    return false;
  }

  /**
   * Send pageview
   */
  cloudcounter.count = function(vars) {
    if (filter()) return;

    var data = getData(vars);
    var url = endpoint + urlencode(data);

    // Use sendBeacon if available (doesn't block page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
      return;
    }

    // Fallback to image request
    var img = new Image();
    img.src = url;
  };

  /**
   * Track element clicks
   * Usage: <button data-cloudcounter-click="signup-btn">Sign Up</button>
   */
  cloudcounter.bindEvents = function() {
    document.addEventListener('click', function(e) {
      var target = e.target;

      // Walk up the DOM tree looking for data-cloudcounter-click
      while (target && target !== document.body) {
        var clickPath = target.getAttribute('data-cloudcounter-click');
        if (clickPath) {
          cloudcounter.count({
            path: clickPath,
            title: target.getAttribute('data-cloudcounter-title') || target.innerText.trim().slice(0, 50),
            event: true
          });
          return;
        }
        target = target.parentElement;
      }
    });
  };

  /**
   * Helper to skip tracking for current session
   */
  cloudcounter.skip = function() {
    try {
      localStorage.setItem('cloudcounter-skip', 'true');
    } catch (e) {}
  };

  /**
   * Helper to re-enable tracking
   */
  cloudcounter.enable = function() {
    try {
      localStorage.removeItem('cloudcounter-skip');
    } catch (e) {}
  };

  // Auto-count on page load
  function autoCount() {
    if (filter()) return;

    // Wait for page to be visible
    if (document.visibilityState === 'visible') {
      cloudcounter.count();
    } else {
      document.addEventListener('visibilitychange', function handler() {
        if (document.visibilityState === 'visible') {
          cloudcounter.count();
          document.removeEventListener('visibilitychange', handler);
        }
      });
    }
  }

  // Run on DOM ready
  if (document.body === null) {
    document.addEventListener('DOMContentLoaded', function() {
      autoCount();
      cloudcounter.bindEvents();
    });
  } else {
    autoCount();
    cloudcounter.bindEvents();
  }

  window.cloudcounter = cloudcounter;
})();
