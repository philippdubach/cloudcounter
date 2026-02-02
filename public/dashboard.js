/**
 * CloudCounter Dashboard
 * Full-featured dashboard with charts, sparklines, navigation, and filtering
 */
;(function() {
  'use strict';

  // Chart configuration - GoatCounter purple
  var ACCENT = '#7d4698';
  var ACCENT_LIGHT = 'rgba(125, 70, 152, 0.1)';
  var GRID_COLOR = 'rgba(0, 0, 0, 0.06)';
  var TEXT_COLOR = '#888';
  var PADDING_LEFT = 40;
  var PADDING_RIGHT = 10;
  var PADDING_TOP = 10;
  var PADDING_BOTTOM = 20;

  var canvas, ctx, tooltip;
  var chartPoints = [];
  var chartType = 'line'; // 'line' or 'bar'

  /**
   * Initialize dashboard
   */
  function init() {
    initChart();
    initSparklines();
    initNavigation();
    initFilter();
    initDatePickers();
  }

  // ============================================
  // MAIN CHART
  // ============================================

  function initChart() {
    canvas = document.getElementById('chart');
    if (!canvas || !window.dashboardData || !window.dashboardData.chartData) return;

    ctx = canvas.getContext('2d');

    // Create tooltip element
    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    canvas.parentElement.appendChild(tooltip);

    // Set up event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchstart', handleTouch, { passive: true });
    canvas.addEventListener('touchmove', handleTouch, { passive: true });
    canvas.addEventListener('touchend', handleMouseLeave);

    window.addEventListener('resize', function() { drawChart(); });

    // Set up chart type toggle
    document.querySelectorAll('[data-chart-type]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-chart-type]').forEach(function(b) {
          b.classList.remove('active');
        });
        this.classList.add('active');
        chartType = this.getAttribute('data-chart-type');
        drawChart();
        initSparklines(); // Redraw sparklines with new chart type
      });
    });

    drawChart();
  }

  function drawChart() {
    if (!canvas || !ctx) return;

    var data = window.dashboardData.chartData || [];
    if (data.length === 0) return;

    // Handle high DPI
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    var width = rect.width;
    var height = rect.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Calculate bounds
    var chartWidth = width - PADDING_LEFT - PADDING_RIGHT;
    var chartHeight = height - PADDING_TOP - PADDING_BOTTOM;

    var maxValue = Math.max.apply(null, data.map(function(d) { return d.count; }));
    if (maxValue === 0) maxValue = 1;
    maxValue = niceMax(maxValue);

    // Store points for hover detection
    chartPoints = [];

    // Calculate point positions
    var pointSpacing = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

    for (var i = 0; i < data.length; i++) {
      var x = PADDING_LEFT + i * pointSpacing;
      var y = PADDING_TOP + chartHeight - (data[i].count / maxValue) * chartHeight;

      chartPoints.push({
        x: x,
        y: y,
        count: data[i].count,
        time: data[i].time
      });
    }

    // Draw chart based on type
    if (chartType === 'bar') {
      // Bar chart
      var barWidth = Math.max(2, (chartWidth / data.length) - 2);
      ctx.fillStyle = ACCENT;

      for (var i = 0; i < chartPoints.length; i++) {
        var barHeight = chartHeight - (chartPoints[i].y - PADDING_TOP);
        var barX = chartPoints[i].x - barWidth / 2;
        var barY = PADDING_TOP + chartHeight - barHeight;
        ctx.fillRect(barX, barY, barWidth, barHeight);
      }
    } else {
      // Line chart
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (var i = 0; i < chartPoints.length; i++) {
        if (i === 0) {
          ctx.moveTo(chartPoints[i].x, chartPoints[i].y);
        } else {
          ctx.lineTo(chartPoints[i].x, chartPoints[i].y);
        }
      }
      ctx.stroke();

      // Draw dots at each point (visible even with 1 point)
      ctx.fillStyle = ACCENT;
      for (var i = 0; i < chartPoints.length; i++) {
        ctx.beginPath();
        ctx.arc(chartPoints[i].x, chartPoints[i].y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Y-axis max value
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(formatNumber(maxValue), width - PADDING_RIGHT, PADDING_TOP);
  }

  function handleMouseMove(e) {
    if (chartPoints.length === 0) return;

    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;

    // Find closest point
    var closest = null;
    var closestDist = Infinity;

    for (var i = 0; i < chartPoints.length; i++) {
      var dist = Math.abs(chartPoints[i].x - x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = chartPoints[i];
      }
    }

    // For bar charts, use larger threshold based on bar spacing
    var threshold = 30;
    if (chartType === 'bar' && chartPoints.length > 0) {
      var chartWidth = rect.width - PADDING_LEFT - PADDING_RIGHT;
      var barSpacing = chartWidth / chartPoints.length;
      threshold = Math.max(30, barSpacing / 2 + 5);
    }

    if (closest && closestDist < threshold) {
      showTooltip(closest, rect);
      drawHighlight(closest);
    } else {
      hideTooltip();
      drawChart();
    }
  }

  function handleTouch(e) {
    if (e.touches.length === 0) return;
    var touch = e.touches[0];
    handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  function handleMouseLeave() {
    hideTooltip();
    drawChart();
  }

  function showTooltip(point, canvasRect) {
    var date = formatDateLong(point.time);
    var count = point.count.toLocaleString();

    tooltip.innerHTML = '<strong>' + count + '</strong><br>' + date;

    var tooltipRect = tooltip.getBoundingClientRect();
    var x = point.x - tooltipRect.width / 2;
    var y = point.y - tooltipRect.height - 8;

    x = Math.max(0, Math.min(x, canvasRect.width - tooltipRect.width));
    if (y < 0) y = point.y + 8;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove('visible');
  }

  function drawHighlight(point) {
    drawChart();

    if (chartType === 'bar') {
      // Highlight bar with semi-transparent overlay
      var data = window.dashboardData.chartData || [];
      var chartWidth = canvas.width / (window.devicePixelRatio || 1) - PADDING_LEFT - PADDING_RIGHT;
      var chartHeight = canvas.height / (window.devicePixelRatio || 1) - PADDING_TOP - PADDING_BOTTOM;
      var barWidth = Math.max(2, (chartWidth / data.length) - 2);
      var barHeight = chartHeight - (point.y - PADDING_TOP);
      var barX = point.x - barWidth / 2;
      var barY = PADDING_TOP + chartHeight - barHeight;

      // Draw highlight overlay on hovered bar
      ctx.fillStyle = 'rgba(125, 70, 152, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
    } else {
      // Draw vertical line
      ctx.strokeStyle = 'rgba(125, 70, 152, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(point.x, PADDING_TOP);
      ctx.lineTo(point.x, canvas.height / (window.devicePixelRatio || 1) - PADDING_BOTTOM);
      ctx.stroke();

      // Draw point
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // ============================================
  // SPARKLINES
  // ============================================

  var sparklineTooltip = null;

  function initSparklines() {
    // Create shared sparkline tooltip if not exists
    if (!sparklineTooltip) {
      sparklineTooltip = document.createElement('div');
      sparklineTooltip.className = 'chart-tooltip';
      document.body.appendChild(sparklineTooltip);
    }

    var canvases = document.querySelectorAll('.sparkline-canvas');
    canvases.forEach(function(canvas) {
      drawSparkline(canvas);
      setupSparklineHover(canvas);
    });
  }

  function setupSparklineHover(canvas) {
    // Remove existing listeners to avoid duplicates
    canvas.removeEventListener('mousemove', canvas._sparklineMouseMove);
    canvas.removeEventListener('mouseleave', canvas._sparklineMouseLeave);

    canvas._sparklineMouseMove = function(e) {
      handleSparklineHover(canvas, e);
    };
    canvas._sparklineMouseLeave = function() {
      hideSparklineTooltip();
      drawSparkline(canvas);
    };

    canvas.addEventListener('mousemove', canvas._sparklineMouseMove);
    canvas.addEventListener('mouseleave', canvas._sparklineMouseLeave);
  }

  function handleSparklineHover(canvas, e) {
    var valuesAttr = canvas.getAttribute('data-values');
    if (!valuesAttr) return;

    var values = valuesAttr.split(',').map(function(v) { return parseInt(v, 10) || 0; });
    if (values.length === 0) return;

    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var w = rect.width;
    var h = rect.height;
    var padding = 2;
    var max = Math.max.apply(null, values) || 1;

    // Find closest data point
    var closestIndex = -1;
    var closestDist = Infinity;
    var closestX, closestY;

    if (chartType === 'bar') {
      var barSpacing = (w - padding * 2) / values.length;
      for (var i = 0; i < values.length; i++) {
        var barX = padding + i * barSpacing + barSpacing / 2;
        var dist = Math.abs(barX - x);
        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = i;
          closestX = barX;
          var barHeight = (values[i] / max) * (h - padding * 2);
          closestY = h - padding - barHeight;
        }
      }
    } else {
      var step = values.length > 1 ? (w - padding * 2) / (values.length - 1) : 0;
      for (var i = 0; i < values.length; i++) {
        var pointX = padding + i * step;
        var dist = Math.abs(pointX - x);
        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = i;
          closestX = pointX;
          closestY = padding + (h - padding * 2) - (values[i] / max) * (h - padding * 2);
        }
      }
    }

    // Use generous threshold for sparklines
    var threshold = chartType === 'bar' ? (w / values.length) : Math.max(20, w / values.length);

    if (closestIndex >= 0 && closestDist < threshold) {
      var count = values[closestIndex];
      var date = getSparklineDate(closestIndex, values.length);
      showSparklineTooltip(count, date, rect, closestX, closestY);
      drawSparklineHighlight(canvas, closestIndex, values);
    } else {
      hideSparklineTooltip();
      drawSparkline(canvas);
    }
  }

  function getSparklineDate(index, totalPoints) {
    // Calculate the date for this sparkline point based on dashboard period
    var startDate = new Date(window.dashboardData.start);
    var endDate = new Date(window.dashboardData.end);

    // Sparklines show daily data, so each point is one day
    var dayOffset = index;
    var pointDate = new Date(startDate);
    pointDate.setDate(pointDate.getDate() + dayOffset);

    return formatDateLong(pointDate.toISOString().split('T')[0]);
  }

  function showSparklineTooltip(count, date, canvasRect, pointX, pointY) {
    sparklineTooltip.innerHTML = '<strong>' + count.toLocaleString() + '</strong><br>' + date;

    // Position tooltip above the point, using page coordinates
    var tooltipX = canvasRect.left + pointX + window.scrollX;
    var tooltipY = canvasRect.top + pointY + window.scrollY;

    // Get tooltip dimensions after setting content
    sparklineTooltip.style.left = '0px';
    sparklineTooltip.style.top = '0px';
    sparklineTooltip.classList.add('visible');
    var tooltipRect = sparklineTooltip.getBoundingClientRect();

    // Position above the point
    var finalX = tooltipX - tooltipRect.width / 2;
    var finalY = tooltipY - tooltipRect.height - 6;

    // Keep on screen
    finalX = Math.max(5, Math.min(finalX, window.innerWidth - tooltipRect.width - 5));
    if (finalY < 5) finalY = tooltipY + 10;

    sparklineTooltip.style.left = finalX + 'px';
    sparklineTooltip.style.top = finalY + 'px';
  }

  function hideSparklineTooltip() {
    if (sparklineTooltip) sparklineTooltip.classList.remove('visible');
  }

  function drawSparklineHighlight(canvas, highlightIndex, values) {
    drawSparkline(canvas);

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    var padding = 2;
    var max = Math.max.apply(null, values) || 1;

    if (chartType === 'bar') {
      var barWidth = Math.max(1, (w - padding * 2) / values.length - 1);
      var barSpacing = (w - padding * 2) / values.length;
      var barHeight = (values[highlightIndex] / max) * (h - padding * 2);
      var x = padding + highlightIndex * barSpacing;
      var y = h - padding - barHeight;

      ctx.fillStyle = 'rgba(125, 70, 152, 0.5)';
      ctx.fillRect(x, y, barWidth, barHeight);
    } else {
      var step = values.length > 1 ? (w - padding * 2) / (values.length - 1) : 0;
      var x = padding + highlightIndex * step;
      var y = padding + (h - padding * 2) - (values[highlightIndex] / max) * (h - padding * 2);

      // Draw highlight dot
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawSparkline(canvas) {
    var valuesAttr = canvas.getAttribute('data-values');
    if (!valuesAttr) return;

    var values = valuesAttr.split(',').map(function(v) { return parseInt(v, 10) || 0; });
    if (values.length === 0) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();

    // Validate canvas has non-zero dimensions
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = rect.height;
    var padding = 2;

    var max = Math.max.apply(null, values) || 1;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    if (chartType === 'bar') {
      // Bar sparkline
      var barWidth = Math.max(1, (w - padding * 2) / values.length - 1);
      var barSpacing = (w - padding * 2) / values.length;
      ctx.fillStyle = ACCENT;

      for (var i = 0; i < values.length; i++) {
        var barHeight = (values[i] / max) * (h - padding * 2);
        var x = padding + i * barSpacing;
        var y = h - padding - barHeight;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    } else {
      // Line sparkline
      var step = values.length > 1 ? (w - padding * 2) / (values.length - 1) : 0;

      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (var i = 0; i < values.length; i++) {
        var x = padding + i * step;
        var y = padding + (h - padding * 2) - (values[i] / max) * (h - padding * 2);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw dots (visible even with single point)
      ctx.fillStyle = ACCENT;
      for (var i = 0; i < values.length; i++) {
        var x = padding + i * step;
        var y = padding + (h - padding * 2) - (values[i] / max) * (h - padding * 2);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ============================================
  // DATE NAVIGATION
  // ============================================

  function initNavigation() {
    // Period navigation links
    document.querySelectorAll('[data-nav]').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var action = this.getAttribute('data-nav');
        navigatePeriod(action);
      });
    });
  }

  function navigatePeriod(action) {
    var parts = action.split('-');
    var direction = parts[0]; // 'back' or 'forward'
    var unit = parts[1]; // 'day', 'week', 'month', 'year'

    var startInput = document.querySelector('input[name="period-start"]');
    var endInput = document.querySelector('input[name="period-end"]');

    if (!startInput || !endInput) return;

    var start = new Date(startInput.value);
    var end = new Date(endInput.value);
    var offset = direction === 'back' ? -1 : 1;

    switch (unit) {
      case 'day':
        start.setDate(start.getDate() + offset);
        end.setDate(end.getDate() + offset);
        break;
      case 'week':
        start.setDate(start.getDate() + (7 * offset));
        end.setDate(end.getDate() + (7 * offset));
        break;
      case 'month':
        start.setMonth(start.getMonth() + offset);
        end.setMonth(end.getMonth() + offset);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() + offset);
        end.setFullYear(end.getFullYear() + offset);
        break;
    }

    // Don't navigate into the future
    var today = new Date();
    if (end > today) {
      return;
    }

    startInput.value = formatDateISO(start);
    endInput.value = formatDateISO(end);

    // Submit form
    document.getElementById('dashboard-form').submit();
  }

  function initDatePickers() {
    var startInput = document.querySelector('input[name="period-start"]');
    var endInput = document.querySelector('input[name="period-end"]');

    if (startInput) {
      startInput.addEventListener('change', function() {
        document.getElementById('dashboard-form').submit();
      });
    }

    if (endInput) {
      endInput.addEventListener('change', function() {
        document.getElementById('dashboard-form').submit();
      });
    }
  }

  // ============================================
  // FILTER
  // ============================================

  function initFilter() {
    var filterInput = document.querySelector('.filter-input');
    if (!filterInput) return;

    var debounceTimer = null;

    filterInput.addEventListener('input', function() {
      var query = this.value.toLowerCase().trim();

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        filterPages(query);
      }, 200);
    });

    // Submit on enter
    filterInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        // For server-side filtering, uncomment:
        // document.getElementById('dashboard-form').submit();
      }
    });
  }

  function filterPages(query) {
    var rows = document.querySelectorAll('.page-row');

    if (query.length < 2) {
      // Show all
      rows.forEach(function(row) {
        row.style.display = '';
      });
      return;
    }

    rows.forEach(function(row) {
      var path = (row.getAttribute('data-path') || '').toLowerCase();
      var title = (row.getAttribute('data-title') || '').toLowerCase();
      var matches = path.includes(query) || title.includes(query);
      row.style.display = matches ? '' : 'none';
    });
  }

  // ============================================
  // UTILITIES
  // ============================================

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  function niceMax(value) {
    if (value <= 0) return 1;
    var magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    var normalized = value / magnitude;

    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
  }

  function formatDateISO(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function formatDateLong(isoString) {
    try {
      var date = new Date(isoString);
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Check if it includes time (hourly data)
      if (isoString.includes('T')) {
        var hours = date.getHours();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return months[date.getMonth()] + ' ' + date.getDate() + ', ' + hours + ' ' + ampm;
      }

      return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    } catch (e) {
      return isoString;
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Redraw on visibility change
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      drawChart();
      initSparklines();
    }
  });
})();
