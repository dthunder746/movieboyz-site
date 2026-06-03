import {
  fmt, fmtPct, colorClass, formatShortDate, pickIcon,
  weekTitle, isoWeekBounds, dateToIsoWeekKey, getWeekdayAbbr, ownerBadge
} from './utils.js';

function shiftIsoDate(iso, deltaDays) {
  var d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().split('T')[0];
}

export function buildInfoCards(data, colorMap) {
  var el = document.getElementById('info-cards');
  if (!el) return;

  var today = data.latest_date || new Date().toISOString().split('T')[0];
  var COOKIE = 'info_active_tab';

  function readTabCookie() {
    var match = document.cookie.match(/(?:^|;)\s*info_active_tab=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function writeTabCookie(id) {
    var exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    document.cookie = COOKIE + '=' + encodeURIComponent(id)
      + '; expires=' + exp.toUTCString() + '; path=/; SameSite=Lax';
  }

  var activeTab = readTabCookie() || 'upcoming';

  function movieIcon(m) {
    var type = m.pick_type || (m.release_date ? 'seasonal' : null);
    return pickIcon(type, m.release_date);
  }

  function movieCell(m) {
    return ownerBadge(m.owner, colorMap) + movieIcon(m) + m.movie_title;
  }

  function formatWindow(theatrical, digital) {
    if (!theatrical || theatrical === 'TBA' || !digital) return '—';
    var t = new Date(theatrical + 'T00:00:00Z').getTime();
    var d = new Date(digital   + 'T00:00:00Z').getTime();
    if (isNaN(t) || isNaN(d)) return '—';
    var days = Math.round((d - t) / 86400000);
    var sign = days >= 0 ? '+' : '';
    return sign + days + 'd';
  }

  var movies = Object.values(data.movies);

  var upcoming = movies.filter(function(m) {
    return m.days_running == null && m.release_date > today;
  }).sort(function(a, b) { return a.release_date < b.release_date ? -1 : 1; });

  // Full sorted arrays — row count for these is calculated dynamically from container height.
  var profitable = movies.filter(function(m) { return m.profit_td != null && m.profit_td > 0; })
    .sort(function(a, b) { return b.profit_td - a.profit_td; });

  var worst = movies.filter(function(m) { return m.profit_td != null && m.profit_td < 0; })
    .sort(function(a, b) { return a.profit_td - b.profit_td; });

  var streamingMovies = movies.filter(function(m) {
    if (!m.released_digital) return false;
    if (m.owner && m.owner !== 'none') return true;
    if (!m.release_date || m.release_date === 'TBA') return false;
    if (m.release_date.slice(0, 4) !== '2026') return false;
    if (m.released_digital < m.release_date) return false;
    return true;
  });
  var upcomingDigital = streamingMovies.filter(function(m) {
    return m.released_digital > today;
  }).sort(function(a, b) { return a.released_digital < b.released_digital ? -1 : 1; });
  var availableNow = streamingMovies.filter(function(m) {
    return m.released_digital <= today;
  }).sort(function(a, b) { return a.released_digital > b.released_digital ? -1 : 1; });

  // ── Top Daily ────────────────────────────────────────────────────────────
  // Uses daily_change (incremental per-day gross) rather than daily_gross
  // (cumulative-to-date). Movies with zero change are excluded — a zero
  // typically means the API did not report an update, not a real zero day.
  var latestDate = data.latest_date || null;
  var dailyRows  = [];
  if (latestDate) {
    var yDate = shiftIsoDate(latestDate, -1);
    var wDate = shiftIsoDate(latestDate, -7);
    dailyRows = movies.filter(function(m) {
      return m.daily_change && m.daily_change[latestDate] != null && m.daily_change[latestDate] !== 0;
    }).map(function(m) {
      var today    = m.daily_change[latestDate];
      var yest     = m.daily_change[yDate];
      var lastWeek = m.daily_change[wDate];
      return {
        movie:  m,
        gross:  today,
        pctYd:  (yest != null && yest !== 0)         ? (today - yest)     / yest     * 100 : null,
        pctLw:  (lastWeek != null && lastWeek !== 0) ? (today - lastWeek) / lastWeek * 100 : null,
      };
    }).sort(function(a, b) { return b.gross - a.gross; });
  }

  // ── Top Weekly ───────────────────────────────────────────────────────────
  // currentWeek is the ISO week containing latest_date. %LW compares this
  // week's partial gross against last week's partial gross up to the same
  // weekday, so a mid-week snapshot is an apples-to-apples comparison.
  var currentWeek    = latestDate ? dateToIsoWeekKey(latestDate) : null;
  var sameDayLastWk  = latestDate ? shiftIsoDate(latestDate, -7) : null;
  var lastWeekBounds = sameDayLastWk ? isoWeekBounds(dateToIsoWeekKey(sameDayLastWk)) : null;

  function sumDailyChangeInRange(m, startIso, endIso) {
    if (!m.daily_change) return 0;
    var sum = 0;
    Object.keys(m.daily_change).forEach(function(d) {
      if (d >= startIso && d <= endIso) {
        var v = m.daily_change[d];
        if (typeof v === 'number') sum += v;
      }
    });
    return sum;
  }

  var weeklyRows = [];
  if (currentWeek) {
    weeklyRows = movies.filter(function(m) {
      return m.weekly_gross && m.weekly_gross[currentWeek] != null && m.weekly_gross[currentWeek] !== 0;
    }).map(function(m) {
      var thisWk = m.weekly_gross[currentWeek];
      var lastWkPartial = (lastWeekBounds && sameDayLastWk)
        ? sumDailyChangeInRange(m, lastWeekBounds.start, sameDayLastWk)
        : 0;
      return {
        movie: m,
        gross: thisWk,
        pctLw: (lastWkPartial !== 0) ? (thisWk - lastWkPartial) / lastWkPartial * 100 : null
      };
    }).sort(function(a, b) { return b.gross - a.gross; });
  }

  function dailyTabLabel() {
    if (!latestDate) return 'Top Daily';
    var parts = latestDate.split('-');       // YYYY-MM-DD
    var dd    = parts[2];
    var m     = String(parseInt(parts[1], 10));
    var abbr  = getWeekdayAbbr(latestDate);            // e.g. 'TUE'
    var day   = abbr[0] + abbr.slice(1).toLowerCase(); // 'Tue'
    return 'Top Daily (' + day + ' ' + dd + '/' + m + ')';
  }

  function weeklyTabLabel() {
    if (!currentWeek) return 'Top Weekly';
    return 'Top Weekly (' + weekTitle(currentWeek) + ')';
  }

  function buildPaneContent(tabId, tabData) {
    if (!tabData.length) {
      return '<p class="info-tab-empty">No data available</p>';
    }

    if (tabId === 'daily')     return buildDailyPane(tabData);
    if (tabId === 'weekly')    return buildWeeklyPane(tabData);
    if (tabId === 'streaming') return buildStreamingPane();

    var isUpcoming = tabId === 'upcoming';
    var thead = '<thead><tr>'
      + '<th>Movie</th>'
      + (isUpcoming
          ? '<th>Date</th>'
          : '<th class="text-end">Profit</th><th class="text-end">ROI</th>')
      + '</tr></thead>';

    var rows = tabData.map(function(m) {
      var cells;
      if (isUpcoming) {
        cells = '<td>' + formatShortDate(m.release_date) + '</td>';
      } else {
        var roi = m.breakeven ? (m.profit_td / m.breakeven * 100) : null;
        cells = '<td class="text-end ' + colorClass(m.profit_td) + '">' + fmt(m.profit_td) + '</td>'
          + '<td class="text-end text-neu">' + (roi !== null ? fmtPct(roi) : '—') + '</td>';
      }
      return '<tr>'
        + '<td>' + movieCell(m) + '</td>'
        + cells
        + '</tr>';
    }).join('');

    return '<div class="info-card-table-wrap">'
      + '<table class="scorecard-movie-table">'
      + thead
      + '<tbody>' + rows + '</tbody>'
      + '</table>'
      + '</div>';
  }

  function pctCell(v) {
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    return '<span class="' + colorClass(v) + '">' + fmtPct(v) + '</span>';
  }

  function buildDailyPane(rows) {
    var thead = '<thead><tr>'
      + '<th>Movie</th>'
      + '<th class="text-end" title="Daily gross">'
      +   '<span class="d-none d-sm-inline">Daily Gross</span>'
      +   '<span class="d-inline d-sm-none">DG</span>'
      + '</th>'
      + '<th class="text-end info-pct-col" title="Change vs yesterday’s daily gross">%YD</th>'
      + '<th class="text-end info-pct-col" title="Change vs same weekday last week">%LW</th>'
      + '</tr></thead>';

    var body = rows.map(function(r) {
      var m = r.movie;
      return '<tr>'
        + '<td>' + movieCell(m) + '</td>'
        + '<td class="text-end">' + fmt(r.gross) + '</td>'
        + '<td class="text-end">' + pctCell(r.pctYd) + '</td>'
        + '<td class="text-end">' + pctCell(r.pctLw) + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="info-card-table-wrap">'
      + '<table class="scorecard-movie-table">'
      + thead
      + '<tbody>' + body + '</tbody>'
      + '</table>'
      + '</div>';
  }

  function buildWeeklyPane(rows) {
    var thead = '<thead><tr>'
      + '<th>Movie</th>'
      + '<th class="text-end">Gross</th>'
      + '<th class="text-end info-pct-col" title="Change vs last week to the same weekday">%LW</th>'
      + '</tr></thead>';

    var body = rows.map(function(r) {
      var m = r.movie;
      return '<tr>'
        + '<td>' + movieCell(m) + '</td>'
        + '<td class="text-end">' + fmt(r.gross) + '</td>'
        + '<td class="text-end">' + pctCell(r.pctLw) + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="info-card-table-wrap">'
      + '<table class="scorecard-movie-table">'
      + thead
      + '<tbody>' + body + '</tbody>'
      + '</table>'
      + '</div>';
  }

  function buildStreamingSection(title, rows) {
    if (!rows.length) return '';
    var thead = '<thead><tr>'
      + '<th>Movie</th>'
      + '<th>Digital</th>'
      + '<th class="text-end" title="Days from theatrical release to digital release.">Window</th>'
      + '</tr></thead>';

    var body = rows.map(function(m) {
      return '<tr>'
        + '<td>' + movieCell(m) + '</td>'
        + '<td>' + formatShortDate(m.released_digital) + '</td>'
        + '<td class="text-end">' + formatWindow(m.release_date, m.released_digital) + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="info-section-header">' + title + '</div>'
      + '<table class="scorecard-movie-table">'
      + thead
      + '<tbody>' + body + '</tbody>'
      + '</table>';
  }

  function buildStreamingPane() {
    return '<div class="info-card-table-wrap">'
      + buildStreamingSection('Upcoming Digital Releases', upcomingDigital)
      + buildStreamingSection('Available Now',           availableNow)
      + '</div>';
  }

  var tabs = [
    { id: 'upcoming',   label: 'Upcoming',         data: upcoming,        row: 1 },
    { id: 'profitable', label: 'Most Profitable',  data: profitable,      row: 1 },
    { id: 'worst',      label: 'Least Profitable', data: worst,           row: 1 },
    { id: 'streaming',  label: 'Streaming',        data: streamingMovies, row: 2 },
    { id: 'daily',      label: dailyTabLabel(),    data: dailyRows,       row: 2 },
    { id: 'weekly',     label: weeklyTabLabel(),   data: weeklyRows,      row: 2 }
  ];

  function btnHtml(t) {
    return '<button class="info-tab-btn' + (t.id === activeTab ? ' active' : '') + '" data-tab="' + t.id + '">'
      + t.label + '</button>';
  }

  var row1Html = tabs.filter(function(t) { return t.row === 1; }).map(btnHtml).join('');
  var row2Html = tabs.filter(function(t) { return t.row === 2; }).map(btnHtml).join('');

  var panesHtml = tabs.map(function(t) {
    return '<div class="info-tab-pane' + (t.id === activeTab ? ' active' : '') + '" data-tab="' + t.id + '">'
      + buildPaneContent(t.id, t.data)
      + '</div>';
  }).join('');

  el.innerHTML = '<div class="info-tab-card">'
    + '<div class="info-tab-nav">' + row1Html + '</div>'
    + '<div class="info-tab-nav info-tab-nav-secondary">' + row2Html + '</div>'
    + '<div class="info-tab-body">' + panesHtml + '</div>'
    + '</div>';

  // ── Height sync: drive #info-cards height from the strip on desktop ───────
  // align-items: stretch is NOT used — it would let #info-cards content grow
  // the container height, preventing the strip from shrinking. Instead we
  // observe the strip and set an explicit height on #info-cards so the flex
  // chain inside (.info-tab-card / .info-tab-body) has a definite height to
  // work against.
  var strip = document.getElementById('weekend-strip');

  function syncHeight() {
    if (window.innerWidth < 936 || !strip) {
      el.style.height = '';
      return;
    }
    el.style.height = strip.offsetHeight + 'px';
  }

  if (typeof ResizeObserver !== 'undefined' && strip) {
    new ResizeObserver(syncHeight).observe(strip);
  }
  syncHeight();
  window.addEventListener('resize', syncHeight);

  // ── Tab click ────────────────────────────────────────────────────────────
  el.addEventListener('click', function(e) {
    var btn = e.target.closest('.info-tab-btn');
    if (!btn) return;
    var id = btn.dataset.tab;
    el.querySelectorAll('.info-tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === id);
    });
    el.querySelectorAll('.info-tab-pane').forEach(function(p) {
      p.classList.toggle('active', p.dataset.tab === id);
    });
    writeTabCookie(id);
  });
}
