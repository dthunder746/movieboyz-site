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

  // ── Unowned-movie visibility ──────────────────────────────────────────
  var _showUnowned = false;

  function applyTableFilter(activeOwners) {
    if (!_table) return;
    if (activeOwners.length > 0) {
      _table.setFilter('owner', 'in', activeOwners);
    } else if (!_showUnowned) {
      _table.setFilter('owner', '!=', 'none');
    } else {
      _table.clearFilter();
    }
  }

  // ── Movie-selection helpers ───────────────────────────────────────────
  var _suppressMovieSelection = false;
  var clearMovieBtn = null; // assigned after buildTable

  function updateChartHeading(activeOwners, activeMovieIds) {
    var heading = document.getElementById('chart-heading');
    if (!heading) return;
    if (activeMovieIds.length > 0) {
      if (activeMovieIds.length === 1) {
        var m = data.movies[activeMovieIds[0]];
        heading.textContent = m ? m.movie_title : 'Selected Movie';
      } else if (activeMovieIds.length === 2) {
        heading.textContent = activeMovieIds.map(function(id) {
          var m = data.movies[id]; return m ? m.movie_title : id;
        }).join(' · ');
      } else {
        heading.textContent = activeMovieIds.length + ' Movies';
      }
    } else if (activeOwners.length === 1) {
      heading.textContent = activeOwners[0] + ': Movie Profits';
    } else {
      heading.textContent = 'Profit Over Time';
    }
  }

  // ── Owner filter state ─────────────────────────────────────────────────
  var ownerFilter = createOwnerFilter(function onChange(activeOwners) {
    // Re-render all linked components whenever the selection changes
    buildLeaderboard(data, owners, colorMap, LATEST_PROFIT_DATE, activeOwners);
    buildOwnerFilter(owners, colorMap, activeOwners, _showUnowned);

    // Clear movie selection so chart stays consistent with table view
    _suppressMovieSelection = true;
    if (_table) _table.deselectRow();
    _suppressMovieSelection = false;
    if (clearMovieBtn) clearMovieBtn.classList.add('d-none');

    if (_chart) _chart.destroy();
    _chart = buildChart(data, owners, colorMap, activeOwners, []);

    updateChartHeading(activeOwners, []);

    applyTableFilter(activeOwners);
  });

  // Initial render (unowned hidden by default)
  buildLeaderboard(data, owners, colorMap, LATEST_PROFIT_DATE, []);
  _chart = buildChart(data, owners, colorMap, [], []);
  _table = buildTable(data, owners, colorMap, LATEST_DATE);
  buildOwnerFilter(owners, colorMap, [], _showUnowned);
  applyTableFilter([]);

  // ── Movie selection (Tabulator as source of truth) ────────────────────
  clearMovieBtn = document.getElementById('clear-movie-selection');

  _table.on('rowSelectionChanged', function(selectedData) {
    if (_suppressMovieSelection) return;
    var activeMovieIds = selectedData.map(function(d) { return d.imdb_id; });
    if (_chart) _chart.destroy();
    _chart = buildChart(data, owners, colorMap, ownerFilter.getActive(), activeMovieIds);
    updateChartHeading(ownerFilter.getActive(), activeMovieIds);
    if (clearMovieBtn) {
      if (activeMovieIds.length > 0) clearMovieBtn.classList.remove('d-none');
      else                           clearMovieBtn.classList.add('d-none');
    }
  });

  if (clearMovieBtn) {
    clearMovieBtn.addEventListener('click', function() {
      if (_table) _table.deselectRow();
    });
  }

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
      if (e.target.closest('[data-toggle-unowned]')) {
        _showUnowned = !_showUnowned;
        buildOwnerFilter(owners, colorMap, ownerFilter.getActive(), _showUnowned);
        applyTableFilter(ownerFilter.getActive());
        return;
      }
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
