import { fmtTimestamp, formatDayMonth, fmtRelativeAgo, getWeekdayAbbr } from './utils.js';
import { buildColorMap } from './palettes.js';
import { createFilterState } from './filters.js';
import { createToolbar } from './toolbar.js';
import { buildLeaderboard } from './leaderboard.js';
import { buildChart } from './chart.js';
import { buildDetailedTable, buildCompactTable } from './table.js';
import { buildWeekendStrip } from './weekend-strip.js';
import { buildInfoCards } from './info-cards.js';
import { applyOverrides } from './overrides.js';
import { createSelection } from './selection.js';
import { initialMode, createModeSwitcher } from './table-mode.js';
import { buildCards } from './table-cards.js';

// ── Module-level chart / table instances ─────────────────────────────────
var _chart = null;
var _table = null;

// ── Favicon (circle + leader's initial) ───────────────────────────────────
// League is fixed at 5 known players, so we can build a color map synchronously
// before data.json loads and paint the favicon from cache or a hardcoded default.

var KNOWN_OWNERS = ['Chris', 'Connie', 'Emerson', 'Marcus', 'Matt'];
var earlyColorMap = buildColorMap(KNOWN_OWNERS);

function setFavicon(owner, color) {
  var canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(owner.charAt(0).toUpperCase(), 16, 17);
  var link = document.querySelector('link[rel="icon"]') || document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = canvas.toDataURL('image/png');
  if (!link.parentNode) document.head.appendChild(link);
}

var cachedLeader = localStorage.getItem('mbLeader') || 'Emerson';
if (earlyColorMap[cachedLeader]) setFavicon(cachedLeader, earlyColorMap[cachedLeader]);

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
  // Use pre-computed top-level dates from the fetcher
  var LATEST_PROFIT_DATE = data.latest_profit_date || null;

  var owners   = Object.keys(data.owners || {}).sort();
  var colorMap = buildColorMap(owners);

  // Reconcile favicon with the actual leader from data.json
  var leader = null;
  owners.forEach(function(o) {
    var totals = data.owners[o] && data.owners[o].total;
    var t = (totals && totals[data.latest_profit_date]) || 0;
    if (leader === null || t > leader.total) leader = { owner: o, total: t };
  });
  if (leader && colorMap[leader.owner]) {
    if (leader.owner !== cachedLeader) setFavicon(leader.owner, colorMap[leader.owner]);
    localStorage.setItem('mbLeader', leader.owner);
  }

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

  // Header: Latest Gross date + "updated X ago"
  if (data.latest_date) {
    var dayMonth = formatDayMonth(data.latest_date);
    var parts    = dayMonth.split('/');
    var dd       = parts[0];
    var m        = String(parseInt(parts[1], 10));  // strip leading zero on month only
    var dateLabel = 'Latest Gross: ' + getWeekdayAbbr(data.latest_date) + ' ' + dd + '/' + m;

    var updatedLabel = data.fetched_at
      ? 'Updated ' + fmtRelativeAgo(data.fetched_at)
      : '';

    var dateEl    = document.getElementById('latest-gross-date');
    var updatedEl = document.getElementById('latest-gross-updated');
    if (dateEl)    dateEl.textContent    = dateLabel;
    if (updatedEl) updatedEl.textContent = updatedLabel;

    var statusEl = document.querySelector('.navbar-status');
    if (statusEl) statusEl.classList.remove('d-none');

    var toggleBtn = document.getElementById('navbar-status-toggle');
    if (toggleBtn) {
      var popoverContent = dateLabel + (updatedLabel ? '<br>' + updatedLabel : '');
      toggleBtn.setAttribute('data-bs-content', popoverContent);
      toggleBtn.classList.remove('d-none');
      new bootstrap.Popover(toggleBtn, {
        html:      true,
        trigger:   'click',
        placement: 'bottom',
        container: 'body'
      });
    }
  }

  var _suppressMovieSelection = false;

  function applyTableFilter(visibleIds) {
    if (!_table) return;
    var set = new Set(visibleIds);
    _table.setFilter(function(d) { return set.has(d.imdb_id); });
  }

  // ── Movie-selection helpers ───────────────────────────────────────────
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

  // ── Filter state + toolbar ─────────────────────────────────────────────
  var filters = createFilterState({
    onChange: function(snap) { rerenderForFilters(snap); },
  });

  var toolbar = createToolbar({
    filters: filters,
    owners: owners,
    colorMap: colorMap,
  });

  // The chart and leaderboard only depend on the active owner set (and the
  // plotted-movie selection, handled separately). Search, pick type, date,
  // profitability, etc. are table-row filters that don't touch them — so we
  // only rebuild the chart/leaderboard when the owner set actually changes,
  // keeping search-as-you-type from tearing down and rebuilding the chart.
  var _prevOwnersSig = '';
  function ownersSig(arr) { return (arr || []).slice().sort().join('|'); }

  function rerenderForFilters(snap) {
    toolbar.refresh();
    var visibleIds = filters.filter(data.movies, data.latest_date);
    if (_renderedMode === 'cards') {
      if (_cards) _cards.setVisibleIds(visibleIds);
    } else if (_table) {
      applyTableFilter(visibleIds);
    }
    var activeOwners = snap.owners || [];
    var sig = ownersSig(activeOwners);
    if (sig !== _prevOwnersSig) {
      _prevOwnersSig = sig;
      buildLeaderboard(data, owners, colorMap, LATEST_PROFIT_DATE, activeOwners);
      if (_chart) _chart.destroy();
      _chart = buildChart(data, owners, colorMap, activeOwners, selection.toArray());
      updateChartHeading(activeOwners, selection.toArray());
    }
  }

  // Initial render (unowned hidden by default)
  buildLeaderboard(data, owners, colorMap, LATEST_PROFIT_DATE, []);
  buildWeekendStrip(data, owners, colorMap);
  buildInfoCards(data, colorMap);
  _chart = buildChart(data, owners, colorMap, [], []);

  // ── Movie selection (shared set as source of truth) ───────────────────
  clearMovieBtn = document.getElementById('clear-movie-selection');

  var selection = createSelection(function onSelectionChange(activeMovieIds) {
    var activeOwners = filters.snapshot().owners || [];
    if (_chart) _chart.destroy();
    _chart = buildChart(data, owners, colorMap, activeOwners, activeMovieIds);
    updateChartHeading(activeOwners, activeMovieIds);
    if (clearMovieBtn) {
      clearMovieBtn.disabled = activeMovieIds.length === 0;
    }
    if (_cards) _cards.syncSelection();
  });

  var _helperTip = null;
  function updateHelperText(mode) {
    var el = document.getElementById('table-helper-info');
    if (!el) return;
    var text = (mode === 'cards')
      ? 'Tap a card to expand. Long-press (or right-click) to plot it on the chart.'
      : 'Click rows to plot them on the chart.';
    if (!_helperTip && window.bootstrap && window.bootstrap.Tooltip) {
      _helperTip = new window.bootstrap.Tooltip(el, { title: text, trigger: 'hover focus', placement: 'bottom' });
    } else if (_helperTip) {
      _helperTip.setContent({ '.tooltip-inner': text });
    }
  }

  function wireTableSelection() {
    if (!_table) return;
    _table.on('rowSelectionChanged', function(selectedData) {
      if (_suppressMovieSelection) return;
      selection.set(selectedData.map(function(d) { return d.imdb_id; }));
    });
    syncSelectionIntoTable();
  }

  function syncSelectionIntoTable() {
    if (!_table) return;
    _suppressMovieSelection = true;
    _table.deselectRow();
    var ids = selection.toArray();
    if (ids.length > 0) {
      ids.forEach(function(id) {
        var row = _table.getRow(id);
        if (row) row.select();
      });
    }
    _suppressMovieSelection = false;
  }

  function renderTable(mode) {
    if (!CARD_SORT[_sortId]) _sortId = 'default';
    var surfaceEl = document.getElementById('table-surface');
    var overlay = document.getElementById('render-overlay');
    var scrollY = window.scrollY;
    var isSwitch = !!(_table || _cards);

    // Reserve the current surface height and fade in a skeleton during the swap
    // so the page doesn't collapse (and yank the scroll position) while
    // Tabulator re-renders asynchronously.
    if (isSwitch && surfaceEl) {
      var prevH = surfaceEl.offsetHeight;
      if (prevH) surfaceEl.style.minHeight = prevH + 'px';
      if (overlay) {
        overlay.classList.remove('d-none');
        void overlay.offsetWidth; // reflow so the opacity transition runs
        overlay.classList.add('is-visible');
      }
    }

    var SHOW_MIN = 220; // keep the skeleton up long enough to read as a transition
    var shownAt = performance.now();
    var swapDone = false;
    function finishSwap() {
      if (swapDone) return;
      var elapsed = performance.now() - shownAt;
      if (isSwitch && elapsed < SHOW_MIN) {
        setTimeout(finishSwap, SHOW_MIN - elapsed);
        return;
      }
      swapDone = true;
      if (surfaceEl) surfaceEl.style.minHeight = '';
      if (isSwitch) window.scrollTo(0, scrollY);
      if (overlay) {
        overlay.classList.remove('is-visible');
        setTimeout(function() { overlay.classList.add('d-none'); }, 200);
      }
    }

    if (_table) { _table.destroy(); _table = null; }
    if (_cards) { _cards.destroy(); _cards = null; }
    var tableEl = document.getElementById('movie-table');
    var cardsEl = document.getElementById('movie-cards');
    tableEl.classList.toggle('d-none', mode === 'cards');
    cardsEl.classList.toggle('d-none', mode !== 'cards');
    tableEl.classList.toggle('mode-compact', mode === 'compact');
    tableEl.classList.toggle('mode-detailed', mode === 'detailed');

    var visibleIds = filters.filter(data.movies, data.latest_date);

    if (mode === 'cards') {
      var cs = CARD_SORT[_sortId] || CARD_SORT.default;
      _cards = buildCards(data, colorMap, selection, visibleIds, cs.field, cs.dir);
      _renderedMode = mode;
      markActiveSort(_sortId);
      updateHelperText(mode);
      requestAnimationFrame(finishSwap);
      return;
    }

    var built;
    if (mode === 'compact') {
      built = buildCompactTable(data, colorMap);
    } else {
      built = buildDetailedTable(data, colorMap);
    }
    _table = built.table;
    _initialSort = built.initialSort;
    var twk = built.sortMap && built.sortMap.this_week;
    _latestWeekCol = (twk && twk[0] && /^week_/.test(twk[0].column)) ? twk[0].column : null;
    _renderedMode = mode;
    _suppressSortSync = true;
    wireTableSelection();
    applyTableFilter(visibleIds);
    markActiveSort(_sortId);
    updateHelperText(mode);

    _table.on('dataSorted', function(sorters) {
      if (_suppressSortSync) return;
      var id = idFromSorters(sorters);
      _sortId = id;
      if (id !== 'custom') localStorage.setItem(SORT_KEY, id);
      markActiveSort(id);
    });

    // setSort is only available once the table is built; applying the saved sort
    // synchronously after construction throws. Do it on tableBuilt.
    _table.on('tableBuilt', function() {
      if (_sortId !== 'default') _table.setSort(tableSortSpec(_sortId));
      _suppressSortSync = false;
      requestAnimationFrame(finishSwap);
    });
    // Fallback in case tableBuilt already fired; finishSwap is idempotent.
    setTimeout(function() { _suppressSortSync = false; finishSwap(); }, 250);
  }

  var _cards = null;
  var _initialSort = null;
  var _latestWeekCol = null;
  var _suppressSortSync = false;
  var SORT_KEY = 'mbTableSort';
  var _sortId = localStorage.getItem(SORT_KEY) || 'default';
  var sortMenu = document.getElementById('sort-menu');
  var _savedMode = initialMode();
  var _renderedMode = _savedMode;

  // Maps a sort id to the card comparator (field + direction). 'default' sorts
  // cards by release date ascending — the primary key of the tables' week-gross
  // default sort (the per-week tiebreakers don't translate to a card list).
  var CARD_SORT = {
    default:      { field: 'default',        dir: 'asc'  },
    release_asc:  { field: 'release_date',   dir: 'asc'  },
    release_desc: { field: 'release_date',   dir: 'desc' },
    profit_desc:  { field: 'to_date_profit', dir: 'desc' },
    profit_asc:   { field: 'to_date_profit', dir: 'asc'  },
    roi_desc:     { field: 'roi',            dir: 'desc' },
    roi_asc:      { field: 'roi',            dir: 'asc'  },
    week_desc:    { field: 'this_week',      dir: 'desc' },
    week_asc:     { field: 'this_week',      dir: 'asc'  },
  };

  // Tabulator sort spec for a sort id; 'default' is the table's week-gross sort.
  function tableSortSpec(id) {
    if (id === 'default' || !CARD_SORT[id]) return _initialSort;
    var col;
    if (id.indexOf('release_') === 0)     col = 'release_date';
    else if (id.indexOf('profit_') === 0) col = 'to_date_profit';
    else if (id.indexOf('roi_') === 0)    col = 'roi';
    else if (id.indexOf('week_') === 0)   col = _latestWeekCol || 'release_date';
    var dir = (id.slice(-3) === 'asc') ? 'asc' : 'desc';
    return [{ column: col, dir: dir }];
  }

  function idFromSorters(sorters) {
    if (!sorters || !sorters.length) return 'default';
    var s = sorters[0];
    var f = s.field || (s.column && s.column.getField ? s.column.getField() : null);
    var dir = s.dir;
    if (sorters.length > 1 && f === 'release_date') return 'default';
    if (f === 'release_date')   return dir === 'asc' ? 'release_asc' : 'release_desc';
    if (f === 'to_date_profit') return dir === 'asc' ? 'profit_asc' : 'profit_desc';
    if (f === 'roi')            return dir === 'asc' ? 'roi_asc' : 'roi_desc';
    if (_latestWeekCol && f === _latestWeekCol) return dir === 'asc' ? 'week_asc' : 'week_desc';
    return 'custom';
  }

  function markActiveSort(id) {
    if (!sortMenu) return;
    Array.prototype.forEach.call(sortMenu.querySelectorAll('[data-sort]'), function(b) {
      b.classList.toggle('active', b.dataset.sort === id);
    });
  }

  function applySort(id) {
    _sortId = id;
    if (id !== 'custom') localStorage.setItem(SORT_KEY, id);
    markActiveSort(id);
    if (_renderedMode === 'cards') {
      if (_cards) { var cs = CARD_SORT[id] || CARD_SORT.default; _cards.setSort(cs.field, cs.dir); }
    } else if (_table && id !== 'custom') {
      _suppressSortSync = true;
      _table.setSort(tableSortSpec(id));
      _suppressSortSync = false;
    }
  }

  if (sortMenu) {
    sortMenu.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-sort]');
      if (btn) applySort(btn.dataset.sort);
    });
  }

  renderTable(_savedMode);
  toolbar.refresh();

  createModeSwitcher({
    initial: _savedMode,
    onChange: function(mode) {
      _savedMode = mode;
      renderTable(mode);
    },
  });

  if (clearMovieBtn) {
    clearMovieBtn.addEventListener('click', function() {
      selection.clear();
      if (_table) {
        _suppressMovieSelection = true;
        _table.deselectRow();
        _suppressMovieSelection = false;
      }
    });
  }

  // Leaderboard — event delegation (survives innerHTML re-renders)
  var lbEl = document.getElementById('leaderboard');
  if (lbEl) {
    lbEl.addEventListener('click', function(e) {
      var card = e.target.closest('[data-owner]');
      if (card) filters.toggleOwner(card.dataset.owner);
    });
  }

  document.getElementById('reset-zoom').addEventListener('click', function() {
    if (!_chart) return;
    if (_chart._zoomReset) _chart.zoomScale('x', _chart._zoomReset);
    else _chart.resetZoom();
  });

  var chartWrapper = document.getElementById('chart-wrapper');

  function exitChartFullscreen() {
    chartWrapper.classList.remove('is-fullscreen');
    if (_chart) requestAnimationFrame(function() { _chart.resize(); });
  }

  document.getElementById('fullscreen-chart').addEventListener('click', function() {
    chartWrapper.classList.toggle('is-fullscreen');
    if (_chart) requestAnimationFrame(function() { _chart.resize(); });
  });

  document.getElementById('fullscreen-close').addEventListener('click', exitChartFullscreen);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && chartWrapper.classList.contains('is-fullscreen')) {
      exitChartFullscreen();
    }
  });
}

// ── Load data ──────────────────────────────────────────────────────────────
var DATA_URL = (import.meta.env.VITE_DATA_URL || 'https://raw.githubusercontent.com/dthunder746/movieboyz-site/data/data.json') + '?t=' + Date.now();
var OVERRIDES_URL = '/overrides.json?t=' + Date.now();

Promise.all([
  fetch(DATA_URL).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }),
  fetch(OVERRIDES_URL).then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { return {}; })
])
  .then(function(results) {
    applyOverrides(results[0], results[1]);
    init(results[0]);
  })
  .catch(function(err) {
    document.body.innerHTML += '<div class="alert alert-danger m-3">Failed to load data.json: ' + err.message + '</div>';
  });
