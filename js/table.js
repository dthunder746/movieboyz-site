import {
  fmt, fmtPct, colorClass, ratingColorClass,
  formatShortDate, formatDayMonth, isoWeekBounds, getWeekdayAbbr, dateToIsoWeekKey,
  weekTitle, pickIcon, pickOrSeasonIcon, ownerBadge,
} from './utils.js';

// ── Expandable column group factory ──────────────────────────────────────
// Returns a Tabulator column group definition whose header contains a [+]/[−]
// toggle button that shows/hides the fields listed in hiddenFields.
//
// tableRef: a plain object { current: null } — assign tableRef.current = table
// after the Tabulator instance is constructed.
// initialExpanded: optional boolean; when true the group starts expanded.

function makeExpandableGroup(title, childColumns, hiddenFields, tableRef, initialExpanded) {
  var expanded = !!initialExpanded;
  return {
    title: title,
    titleFormatter: function() {
      var container = document.createElement('span');
      container.textContent = title;
      var btn = document.createElement('span');
      btn.className = 'group-expand-btn';
      btn.textContent = expanded ? '\u2212' : '+';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!tableRef.current) return;
        expanded = !expanded;
        btn.textContent = expanded ? '\u2212' : '+';
        // Batch the per-column show/hide into a single relayout. Without
        // blockRedraw each showColumn/hideColumn triggers its own full redraw,
        // so toggling a week's ~7 day columns reflowed the whole table 7 times.
        var t = tableRef.current;
        if (t.blockRedraw) t.blockRedraw();
        hiddenFields.forEach(function(f) {
          if (expanded) t.showColumn(f);
          else t.hideColumn(f);
        });
        if (t.restoreRedraw) t.restoreRedraw();
        else if (expanded) t.redraw();
      });
      container.appendChild(btn);
      return container;
    },
    columns: childColumns,
  };
}

// ── Tabulator table ───────────────────────────────────────────────────────
// Reads pre-computed fields from each movie record (added by the fetcher).
// Returns the Tabulator instance.

export function buildDetailedTable(data, colorMap) {

  // Collect daily-change dates and weekly keys from pre-computed movie fields
  var allDailyDates = new Set();
  var allWeekKeys   = new Set();
  Object.values(data.movies).forEach(function(m) {
    Object.keys(m.daily_change || {}).forEach(function(d) { allDailyDates.add(d); });
    Object.keys(m.weekly_gross || {}).forEach(function(w) { allWeekKeys.add(w); });
  });
  var sortedDaily = Array.from(allDailyDates).sort();
  var allWeeks    = Array.from(allWeekKeys).sort();

  var anyReleased = sortedDaily.length > 0;

  // Group all daily dates by ISO week key (used to build per-week day columns)
  var datesByWeek = {};
  allDailyDates.forEach(function(d) {
    var wk = dateToIsoWeekKey(d);
    if (!datesByWeek[wk]) datesByWeek[wk] = [];
    datesByWeek[wk].push(d);
  });

  // Build row data from pre-computed fields
  var rows = Object.entries(data.movies).map(function(entry) {
    var imdb_id = entry[0], movie = entry[1];
    var dc = movie.daily_change || {};
    var wg = movie.weekly_gross || {};

    var row = {
      imdb_id:        imdb_id,
      movie_title:    movie.movie_title,
      owner:          movie.owner,
      pick_type:      movie.pick_type,
      release_date:   movie.release_date || 'TBA',
      days_running:   movie.days_running != null ? movie.days_running : null,
      budget:         movie.budget || 0,
      breakeven:      movie.breakeven   != null ? movie.breakeven   : null,
      to_date_gross:  movie.gross_td    != null ? movie.gross_td    : null,
      to_date_profit: movie.profit_td   != null ? movie.profit_td   : null,
      roi: (movie.profit_td != null && movie.breakeven) ? movie.profit_td / movie.breakeven * 100 : null,
    };

    var r = movie.ratings || null;
    row.rating_letterboxd  = r && r.letterboxd  && r.letterboxd.score  != null ? r.letterboxd.score  : null;
    row.rating_imdb        = r && r.imdb        && r.imdb.score        != null ? r.imdb.score        : null;
    row.rating_rt_audience = r && r.rt_audience && r.rt_audience.score != null ? r.rt_audience.score : null;
    row.rating_rt_critic   = r && r.rt_critic   && r.rt_critic.score   != null ? r.rt_critic.score   : null;
    row.rating_tmdb        = r && r.tmdb        && r.tmdb.score        != null ? r.tmdb.score        : null;
    row.rating_metacritic  = r && r.metacritic  && r.metacritic.score  != null ? r.metacritic.score  : null;
    row.ratings_raw        = r;

    allDailyDates.forEach(function(d) {
      row['daily_' + d] = dc[d] !== undefined ? dc[d] : null;
    });

    allWeeks.forEach(function(wk) {
      row['week_' + wk] = wg[wk] !== undefined ? wg[wk] : null;
    });

    return row;
  });

  var hasNegDailyGross = rows.some(function(row) {
    return Object.keys(row).some(function(k) {
      return k.startsWith('daily_') && typeof row[k] === 'number' && row[k] < 0;
    });
  });
  if (hasNegDailyGross) {
    var footnote = document.getElementById('daily-neg-footnote');
    if (footnote) footnote.classList.remove('d-none');
  }

  // Formatters
  function fmtCell(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    return '<span class="' + colorClass(v) + '">' + fmt(v) + '</span>';
  }

  function fmtRoi(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    return '<span class="' + colorClass(v) + '">' + fmtPct(v) + '</span>';
  }

  function fmtGross(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    return fmt(v);
  }

  function fmtWeeklyTotal(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    var cls = v > 0 ? 'text-pos' : 'text-neu';
    return '<span class="' + cls + '">' + fmt(v) + '</span>';
  }

  function fmtDailyCell(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    if (v < 0) return '<span class="daily-neg-revised">' + fmt(v) + '</span>';
    return '<span class="' + colorClass(v) + '">' + fmt(v) + '</span>';
  }

  // Rating sources
  var FAVICON_BASE = 'https://www.google.com/s2/favicons?domain=';
  var RATING_SOURCES = [
    { field: 'rating_letterboxd',  key: 'letterboxd',  label: 'Letterboxd',        icon: FAVICON_BASE + 'letterboxd.com&sz=32',       emoji: false, display: function(v){ return (v/20).toFixed(1); }, visible: true  },
    { field: 'rating_imdb',        key: 'imdb',         label: 'IMDb',              icon: FAVICON_BASE + 'imdb.com&sz=32',             emoji: false, display: function(v){ return (v/10).toFixed(1); }, visible: false },
    { field: 'rating_rt_audience', key: 'rt_audience',  label: 'RT Audience Score', icon: '🍿',                                        emoji: true,  display: function(v){ return v + '%'; },           visible: false },
    { field: 'rating_rt_critic',   key: 'rt_critic',    label: 'RT Tomatometer',    icon: FAVICON_BASE + 'rottentomatoes.com&sz=32',   emoji: false, display: function(v){ return v + '%'; },           visible: false },
    { field: 'rating_tmdb',        key: 'tmdb',         label: 'TMDB',              icon: FAVICON_BASE + 'themoviedb.org&sz=32',       emoji: false, display: function(v){ return (v/10).toFixed(1); }, visible: false },
    { field: 'rating_metacritic',  key: 'metacritic',   label: 'Metacritic',        icon: FAVICON_BASE + 'metacritic.com&sz=32',       emoji: false, display: function(v){ return String(v); },         visible: false },
  ];

  var ratingCols = RATING_SOURCES.map(function(src, i) {
    return {
      title:         src.label,
      field:         src.field,
      cssClass:      i === 0 ? 'week-sep' : undefined,
      titleFormatter: function() {
        if (src.emoji) return '<span style="font-size:14px;line-height:1">' + src.icon + '</span>';
        return '<img src="' + src.icon + '" width="16" height="16" style="vertical-align:middle" alt="' + src.label + '">';
      },
      headerTooltip: src.label,
      hozAlign:      'center',
      minWidth:      src.visible ? 120 : 50,
      visible:       src.visible,
      sorter:        'number',
      formatter: function(cell) {
        var v = cell.getValue();
        if (v === null || v === undefined) return '<span class="text-neu">—</span>';
        return '<span class="' + ratingColorClass(v) + '">' + src.display(v) + '</span>';
      },
      formatterParams: { html: true },
      tooltip: function(e, cell) {
        var raw = cell.getRow().getData().ratings_raw;
        if (!raw || !raw[src.key]) return false;
        var votes = raw[src.key].votes;
        if (votes == null) return false;
        return votes.toLocaleString() + ' votes';
      },
    };
  });

  // Column definitions
  var titleCol = {
    title: 'Movie',
    field: 'movie_title',
    frozen: true,
    minWidth: 230,
    cssClass: 'col-movie-title',
    formatter: function(cell) {
      var row = cell.getRow().getData();
      var badge = ownerBadge(row.owner, colorMap);
      var icon = pickOrSeasonIcon(row.pick_type, row.release_date);
      var title = '<span class="movie-title-text">' + cell.getValue() + '</span>';
      return badge + icon + title;
    },
    formatterParams: { html: true },
    tooltip: function(e, cell) { return cell.getValue(); },
  };

  var openingCol = {
    title: 'Released',
    field: 'release_date',
    minWidth: 80,
    sorter: 'string',
    formatter: function(cell) {
      var v = cell.getValue();
      if (v === 'TBA' || !v) return '<span class="text-neu">TBA</span>';
      return formatShortDate(v);
    },
    formatterParams: { html: true },
  };

  var financialCols = [
    {
      title: 'B/E',
      field: 'breakeven',
      cssClass: 'week-sep',
      hozAlign: 'right',
      minWidth: 80,
      headerTooltip: 'Breakeven (2 × production budget)',
      formatter: fmtGross,
      formatterParams: { html: true },
      sorter: 'number',
    },
    {
      title: 'Gross TD',
      field: 'to_date_gross',
      hozAlign: 'right',
      minWidth: 95,
      formatter: fmtGross,
      formatterParams: { html: true },
      sorter: 'number',
    },
    {
      title: 'Profit TD',
      field: 'to_date_profit',
      hozAlign: 'right',
      minWidth: 95,
      formatter: fmtCell,
      formatterParams: { html: true },
      sorter: 'number',
    },
    {
      title: 'ROI',
      field: 'roi',
      hozAlign: 'right',
      minWidth: 80,
      headerTooltip: 'Return on Investment: (gross − breakeven) / breakeven',
      formatter: fmtRoi,
      formatterParams: { html: true },
      sorter: 'number',
    },
  ];

  // Measure text width using a canvas context to size week group headers dynamically.
  // Returns the minimum column width needed to show the given title + expand button.
  var _measureCanvas = document.createElement('canvas');
  function weekGroupMinWidth(title) {
    var ctx = _measureCanvas.getContext('2d');
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    var textPx = ctx.measureText(title).width;
    // title text + button (14px) + button margin (6px) + cell padding (8px * 2) + buffer (10px)
    return Math.ceil(textPx) + 46;
  }

  // Minimum width for a day column: measure the "DD/MM" date label + sort arrow
  // (Tabulator adds padding-right:25px to sortable titles) + content padding (5px*2).
  function dayColMinWidth(dateStr) {
    var ctx = _measureCanvas.getContext('2d');
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    var dateLabelPx = ctx.measureText(formatDayMonth(dateStr)).width;
    return Math.ceil(dateLabelPx) + 25 + 10 + 8; // sort-arrow + padding + buffer
  }

  // ── Per-week expandable column groups ──────────────────────────────────
  var tableRef = { current: null };
  var hiddenRatingFields = RATING_SOURCES.filter(function(s) { return !s.visible; }).map(function(s) { return s.field; });
  var ratingsGroup = makeExpandableGroup('Ratings', ratingCols, hiddenRatingFields, tableRef, false);

  var reversedWeeks = allWeeks.slice().reverse();

  var perWeekGroups = reversedWeeks.map(function(wk, i) {
    var isCurrentWeek = (i === 0);
    var weekNum = parseInt(wk.split('-W')[1]);

    // Dates to use as day columns for this week, ordered most-recent-first
    var datesForWeek;
    if (isCurrentWeek) {
      // Only dates that have actual data (no future days)
      datesForWeek = (datesByWeek[wk] || []).slice().sort().reverse();
    } else {
      // All 7 days Mon–Sun, ordered Sun→Mon (most-recent-first within the week)
      var bounds = isoWeekBounds(wk);
      var startMs = new Date(bounds.start + 'T00:00:00Z').getTime();
      datesForWeek = [];
      for (var di = 6; di >= 0; di--) {
        var dt = new Date(startMs + di * 86400000);
        datesForWeek.push(
          dt.getUTCFullYear() + '-' +
          String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' +
          String(dt.getUTCDate()).padStart(2, '0')
        );
      }
    }

    // Day columns
    var dayCols = datesForWeek.map(function(d) {
      var abbr = getWeekdayAbbr(d);
      var isWeekend = (abbr === 'SAT' || abbr === 'SUN');
      return {
        title:    formatDayMonth(d),
        field:    'daily_' + d,
        hozAlign: 'right',
        minWidth: dayColMinWidth(d),
        cssClass: ['col-day-column', isWeekend ? 'col-weekend' : null].filter(Boolean).join(' '),
        visible:  isCurrentWeek,
        titleFormatter: function() {
          var cls = 'col-day-label' + (isWeekend ? ' col-weekend-label' : '');
          return '<span class="' + cls + '">' + abbr + '</span><br>' + formatDayMonth(d);
        },
        formatter:       fmtDailyCell,
        formatterParams: { html: true },
        sorter:          'number',
      };
    });

    // Week total column — always visible, italic for current week
    // minWidth is driven by the group header title width so it never clips.
    var weekTotalCol = {
      title:    'Total',
      field:    'week_' + wk,
      hozAlign: 'right',
      minWidth: weekGroupMinWidth(weekTitle(wk)),
      cssClass: isCurrentWeek ? 'week-sep week-current-total' : 'week-sep',
      formatter: fmtWeeklyTotal,
      formatterParams: { html: true },
      sorter:   'number',
    };

    // "week #N" inner sub-group
    var weekSubGroup = {
      title:   'week #' + weekNum,
      titleFormatter: function() {
        var el = document.createElement('span');
        el.style.fontSize = '0.7rem';
        el.style.color = 'var(--bs-secondary-color)';
        el.style.fontWeight = 'normal';
        el.textContent = 'week #' + weekNum;
        return el;
      },
      columns: [weekTotalCol].concat(dayCols),
    };

    // Hidden day fields — all weeks use the same toggle logic
    var hiddenDayFields = datesForWeek.map(function(d) { return 'daily_' + d; });

    var group = makeExpandableGroup(
      weekTitle(wk),
      [weekSubGroup],
      hiddenDayFields,
      tableRef,
      isCurrentWeek
    );

    if (isCurrentWeek) {
      var _baseTF = group.titleFormatter;
      group.titleFormatter = function() {
        var el = _baseTF();
        el.style.fontStyle = 'italic';
        return el;
      };
    }

    return group;
  });

  var columns = [
    titleCol,
    openingCol,
    ratingsGroup,
    { title: 'Financials', columns: financialCols },
  ];

  if (anyReleased && perWeekGroups.length > 0) {
    columns.push({ title: 'Weekly Gross', columns: perWeekGroups });
  }

  var initialSort = (anyReleased && allWeeks.length > 0)
    ? [{ column: 'release_date', dir: 'asc' }].concat(
        allWeeks.map(function(wk) { return { column: 'week_' + wk, dir: 'desc' }; })
      )
    : [{ column: 'release_date', dir: 'asc' }];

  var table = new Tabulator('#movie-table', {
    data:                  rows,
    columns:               columns,
    layout:                'fitDataFill',
    responsiveLayout:      false,
    initialSort:           initialSort,
    columnHeaderVertAlign: 'bottom',
    resizableColumns:      false,
    selectableRows:        true,
    pagination:            true,
    paginationSize:        50,
    paginationSizeSelector: [10, 25, 50, 100, true],
  });

  tableRef.current = table;

  return { table: table, initialSort: initialSort };
}

export function buildCompactTable(data, colorMap) {
  // Collect weekly keys
  var allWeekKeys = new Set();
  Object.values(data.movies).forEach(function(m) {
    Object.keys(m.weekly_gross || {}).forEach(function(w) { allWeekKeys.add(w); });
  });
  var allWeeks = Array.from(allWeekKeys).sort();
  var reversedWeeks = allWeeks.slice().reverse(); // newest first

  // Row data
  var rows = Object.entries(data.movies).map(function(entry) {
    var imdb_id = entry[0], movie = entry[1];
    var wg = movie.weekly_gross || {};
    var row = {
      imdb_id:        imdb_id,
      movie_title:    movie.movie_title,
      owner:          movie.owner,
      pick_type:      movie.pick_type,
      release_date:   movie.release_date || 'TBA',
      breakeven:      movie.breakeven   != null ? movie.breakeven   : null,
      to_date_profit: movie.profit_td   != null ? movie.profit_td   : null,
      roi: (movie.profit_td != null && movie.breakeven) ? movie.profit_td / movie.breakeven * 100 : null,
    };
    reversedWeeks.forEach(function(wk) {
      row['week_' + wk] = wg[wk] !== undefined ? wg[wk] : null;
    });
    return row;
  });

  // Formatters
  function fmtCurrency(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    return fmt(v);
  }
  function fmtProfit(cell) {
    var p = cell.getValue();
    if (p === null || p === undefined) return '<span class="text-neu">—</span>';
    return '<span class="' + colorClass(p) + '">' + fmt(p) + '</span>';
  }
  function fmtRoi(cell) {
    var r = cell.getValue();
    if (r === null || r === undefined) return '<span class="text-neu">—</span>';
    return '<span class="' + colorClass(r) + '">' + (r > 0 ? '+' : '') + Math.round(r) + '%</span>';
  }
  function fmtWeekGross(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    return '<span class="' + colorClass(v) + '">' + fmt(v) + '</span>';
  }

  // Columns
  var titleCol = {
    title: 'Movie',
    field: 'movie_title',
    frozen: true,
    width: 224,
    minWidth: 184,
    cssClass: 'col-movie-title',
    formatter: function(cell) {
      var row = cell.getRow().getData();
      var badge = ownerBadge(row.owner, colorMap);
      var icon = pickOrSeasonIcon(row.pick_type, row.release_date);
      var title = '<span class="movie-title-text">' + cell.getValue() + '</span>';
      return badge + icon + title;
    },
    formatterParams: { html: true },
    tooltip: function(e, cell) { return cell.getValue(); },
  };

  var releasedCol = {
    title: 'Released',
    field: 'release_date',
    width: 96,
    minWidth: 88,
    sorter: 'string',
    formatter: function(cell) {
      var v = cell.getValue();
      if (v === 'TBA' || !v) return '<span class="text-neu">TBA</span>';
      return formatShortDate(v);
    },
    formatterParams: { html: true },
  };

  var breakevenCol = {
    title: 'B/E',
    field: 'breakeven',
    hozAlign: 'right',
    width: 88,
    minWidth: 76,
    formatter: fmtCurrency,
    formatterParams: { html: true },
    sorter: 'number',
  };

  var profitCol = {
    title: 'Total Profit',
    field: 'to_date_profit',
    hozAlign: 'right',
    width: 110,
    minWidth: 96,
    formatter: fmtProfit,
    formatterParams: { html: true },
    sorter: 'number',
  };

  var roiCol = {
    title: 'ROI',
    field: 'roi',
    hozAlign: 'right',
    width: 84,
    minWidth: 72,
    formatter: fmtRoi,
    formatterParams: { html: true },
    sorter: 'number',
  };

  var weekCols = reversedWeeks.map(function(wk) {
    var weekNum = parseInt(wk.split('-W')[1], 10);
    return {
      title:    'Gross Week #' + weekNum,
      titleFormatter: function() {
        var el = document.createElement('div');
        el.className = 'compact-week-title';
        el.innerHTML = 'Gross<br>Week&nbsp;#' + weekNum;
        return el;
      },
      field:    'week_' + wk,
      hozAlign: 'right',
      width:    96,
      minWidth: 88,
      formatter: fmtWeekGross,
      formatterParams: { html: true },
      sorter:   'number',
    };
  });

  var columns = [titleCol, releasedCol, breakevenCol, profitCol, roiCol].concat(weekCols);

  // Match the Detailed table's default ordering (release date asc, then weeks).
  var initialSort = allWeeks.length > 0
    ? [{ column: 'release_date', dir: 'asc' }].concat(
        allWeeks.map(function(wk) { return { column: 'week_' + wk, dir: 'desc' }; })
      )
    : [{ column: 'release_date', dir: 'asc' }];

  var table = new Tabulator('#movie-table', {
    data:                  rows,
    columns:               columns,
    layout:                'fitDataFill',
    responsiveLayout:      false,
    initialSort:           initialSort,
    columnHeaderVertAlign: 'bottom',
    resizableColumns:      false,
    selectableRows:        true,
    pagination:            true,
    paginationSize:        50,
    paginationSizeSelector: [10, 25, 50, 100, true],
  });

  return {
    table: table,
    initialSort: initialSort,
  };
}

// ── Owner filter ──────────────────────────────────────────────────────────
// Pure render — no internal state. Reads activeOwners array, paints buttons.
// Clicks are handled via event delegation in app.js.

export function buildOwnerFilter(owners, colorMap, activeOwners, showUnowned) {
  var container = document.getElementById('owner-filter');
  if (!container) return;
  var activeSet = new Set(activeOwners);

  container.innerHTML = '';

  owners.forEach(function(owner) {
    var active = activeSet.has(owner);
    var btn = document.createElement('button');
    btn.className = 'btn btn-sm ' + (active ? 'btn-primary' : 'btn-outline-secondary');
    if (active) btn.style.backgroundColor = colorMap[owner];
    btn.style.borderColor = colorMap[owner];
    btn.dataset.owner = owner;
    btn.innerHTML = '<span class="owner-dot" style="background:' + colorMap[owner] + '"></span>' + owner;
    container.appendChild(btn);
  });

  var unownedToggle = document.createElement('button');
  unownedToggle.className = 'btn btn-sm btn-outline-secondary';
  unownedToggle.textContent = showUnowned ? 'Hide unowned movies' : 'Show unowned movies';
  unownedToggle.dataset.toggleUnowned = '1';
  container.appendChild(unownedToggle);

  var clear = document.createElement('button');
  clear.className = 'btn btn-sm btn-outline-secondary';
  clear.textContent = 'Reset';
  clear.dataset.clear = '1';
  container.appendChild(clear);
}
