import { fmtTimestamp } from './utils.js';
import { buildColorMap } from './palettes.js';
import { createOwnerFilter } from './filter.js';
import { buildLeaderboard } from './leaderboard.js';
import { buildChart } from './chart.js';
import { buildTable, buildOwnerFilter } from './table.js';

// ── Module-level chart / table instances ─────────────────────────────────
var _chart = null;
var _table = null;

// ── Theme ─────────────────────────────────────────────────────────────────

var themeSwitch = document.getElementById('themeSwitch');
var saved = localStorage.getItem('mbTheme') || 'dark';
if (themeSwitch) themeSwitch.checked = (saved === 'light');

if (themeSwitch) {
  themeSwitch.addEventListener('change', function() {
    var theme = themeSwitch.checked ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('mbTheme', theme);
    if (_chart) {
      var gridColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      var tickColor = theme === 'dark' ? '#aaa' : '#555';
      _chart.options.scales.x.grid.color  = gridColor;
      _chart.options.scales.x.ticks.color = tickColor;
      _chart.options.scales.y.grid.color  = gridColor;
      _chart.options.scales.y.ticks.color = tickColor;
      _chart.options.plugins.legend.labels.color = tickColor;
      _chart.update();
    }
    if (_table) {
      _table.redraw(true);
    }
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

function init(data) {
  // LATEST_DATE — max date with actual gross data, used by table for accuracy
  var allGrossDates = Object.values(data.movies || {}).flatMap(function(m) {
    return Object.keys(m.daily_gross || {});
  });
  var LATEST_DATE = allGrossDates.length ? allGrossDates.slice().sort().at(-1) : null;

  // LATEST_PROFIT_DATE — max date in owner totals, used by leaderboard
  var allProfitDates = Object.values(data.owners || {}).flatMap(function(o) {
    return Object.keys(o.total || {});
  });
  var LATEST_PROFIT_DATE = allProfitDates.length ? allProfitDates.slice().sort().at(-1) : null;

  var owners   = Object.keys(data.owners || {}).sort();
  var colorMap = buildColorMap(owners);

  // Footer: data.json fetched_at
  if (data.fetched_at) {
    var elData = document.getElementById('data-updated');
    if (elData) elData.textContent = 'data.json updated ' + fmtTimestamp(data.fetched_at);
  }

  // Footer: index.html last commit via GitHub API
  fetch('https://api.github.com/repos/dthunder746/movieboyz-site/commits?path=index.html&per_page=1')
    .then(function(r) { return r.json(); })
    .then(function(commits) {
      if (commits && commits[0] && commits[0].commit) {
        var dateStr = commits[0].commit.committer.date;
        var elSite = document.getElementById('site-updated');
        if (elSite) elSite.textContent = 'index.html updated ' + fmtTimestamp(new Date(dateStr));
      }
    })
    .catch(function() {});

  // ── Owner filter state ─────────────────────────────────────────────────
  var ownerFilter = createOwnerFilter(function onChange(activeOwners) {
    // Re-render all linked components whenever the selection changes
    buildLeaderboard(data, owners, colorMap, LATEST_PROFIT_DATE, activeOwners);
    buildOwnerFilter(owners, colorMap, activeOwners);

    if (_chart) _chart.destroy();
    _chart = buildChart(data, owners, colorMap, activeOwners);

    var heading = document.getElementById('chart-heading');
    if (heading) {
      heading.textContent = activeOwners.length === 1
        ? activeOwners[0] + ': Movie Profits'
        : 'Profit Over Time';
    }

    if (_table) {
      if (activeOwners.length === 0) _table.clearFilter();
      else _table.setFilter('owner', 'in', activeOwners);
    }
  });

  // Initial render (empty selection = show everything)
  buildLeaderboard(data, owners, colorMap, LATEST_PROFIT_DATE, []);
  _chart = buildChart(data, owners, colorMap, []);
  _table = buildTable(data, owners, colorMap, LATEST_DATE);
  buildOwnerFilter(owners, colorMap, []);

  // Leaderboard — event delegation (survives innerHTML re-renders)
  var lbEl = document.getElementById('leaderboard');
  if (lbEl) {
    lbEl.addEventListener('click', function(e) {
      var card = e.target.closest('[data-owner]');
      if (card) ownerFilter.toggle(card.dataset.owner);
    });
  }

  // Owner filter — event delegation
  var ofEl = document.getElementById('owner-filter');
  if (ofEl) {
    ofEl.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-owner]');
      if (btn) { ownerFilter.toggle(btn.dataset.owner); return; }
      if (e.target.closest('[data-clear]')) ownerFilter.clear();
    });
  }

  document.getElementById('reset-zoom').addEventListener('click', function() {
    if (_chart) _chart.resetZoom();
  });
}

// ── Load data ──────────────────────────────────────────────────────────────
var DATA_URL = 'https://raw.githubusercontent.com/dthunder746/movieboyz-site/data/data.json?t=' + Date.now();
fetch(DATA_URL)
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(init)
  .catch(function(err) {
    document.body.innerHTML += '<div class="alert alert-danger m-3">Failed to load data.json: ' + err.message + '</div>';
  });
