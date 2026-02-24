import {
  fmt, colorClass,
  formatShortDate, formatDayMonth, isoWeekBounds,
} from './utils.js';

// ── Tabulator table ───────────────────────────────────────────────────────
// Reads pre-computed fields from each movie record (added by the fetcher).
// Returns { table, hiddenWeekCols } where hiddenWeekCols is an array of
// field names for week columns that start hidden (all weeks beyond last 4).

export function buildTable(data, colorMap) {

  // Collect daily-change dates and weekly keys from pre-computed movie fields
  var allDailyDates = new Set();
  var allWeekKeys   = new Set();
  Object.values(data.movies).forEach(function(m) {
    Object.keys(m.daily_change || {}).forEach(function(d) { allDailyDates.add(d); });
    Object.keys(m.weekly_gross || {}).forEach(function(w) { allWeekKeys.add(w); });
  });
  var sortedDaily = Array.from(allDailyDates).sort();
  var last7       = sortedDaily.slice(-7);
  var allWeeks    = Array.from(allWeekKeys).sort();

  var anyReleased = sortedDaily.length > 0;

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
    };

    last7.forEach(function(d) {
      row['daily_' + d] = dc[d] !== undefined ? dc[d] : null;
    });

    allWeeks.forEach(function(wk) {
      row['week_' + wk] = wg[wk] !== undefined ? wg[wk] : null;
    });

    return row;
  });

  // Formatters
  function fmtCell(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    return '<span class="' + colorClass(v) + '">' + fmt(v) + '</span>';
  }

  function fmtGross(cell) {
    var v = cell.getValue();
    if (v === null || v === undefined) return '<span class="text-neu">—</span>';
    return fmt(v);
  }

  // Week column title from ISO week key (Mon–Sun date range)
  function weekTitle(wk) {
    var b = isoWeekBounds(wk);
    var sm = b.start.split('-'), em = b.end.split('-');
    return sm[1] === em[1]
      ? formatShortDate(b.start) + '–' + parseInt(em[2])
      : formatShortDate(b.start) + '–' + formatShortDate(b.end);
  }

  // Column definitions
  var titleCol = {
    title: 'Movie',
    field: 'movie_title',
    frozen: true,
    minWidth: 190,
    formatter: function(cell) {
      var row = cell.getRow().getData();
      var dot = '<span class="owner-dot" style="background:' + (colorMap[row.owner] || '#888') + '"></span>';
      var badge = row.pick_type ? '<span class="pick-badge pick-' + row.pick_type + '">' + row.pick_type + '</span>' : '';
      return dot + cell.getValue() + (badge ? ' ' + badge : '');
    },
    formatterParams: { html: true },
  };

  var dailyCols = last7.slice().reverse().map(function(d, i) {
    return {
      title: formatDayMonth(d),
      field: 'daily_' + d,
      hozAlign: 'right',
      minWidth: 68,
      cssClass: i === 0 ? 'daily-sep' : '',
      formatter: fmtCell,
      formatterParams: { html: true },
      sorter: 'number',
    };
  });

  // All weeks reversed (most recent first); last 4 visible, older hidden
  var reversedWeeks = allWeeks.slice().reverse();
  var weeklyCols = reversedWeeks.map(function(wk, i) {
    var isLatest = (i === 0);
    var visible  = (i < 4);
    return {
      title:    weekTitle(wk),
      field:    'week_' + wk,
      hozAlign: 'right',
      minWidth: 90,
      visible:  visible,
      cssClass: [i === 0 ? 'week-sep' : null, isLatest ? 'week-latest' : null].filter(Boolean).join(' '),
      formatter: fmtCell,
      formatterParams: { html: true },
      sorter: 'number',
    };
  });

  // Field names for columns that start hidden (all weeks beyond last 4)
  var hiddenWeekCols = reversedWeeks.slice(4).map(function(wk) { return 'week_' + wk; });

  var columns = [
    {
      title: 'Movie Details',
      columns: [
        titleCol,
        {
          title: 'Opening',
          field: 'release_date',
          minWidth: 120,
          sorter: 'string',
          formatter: function(cell) {
            var row = cell.getRow().getData();
            var rel = row.release_date;
            if (rel === 'TBA') return '<span class="text-neu">TBA</span>';
            var label = formatShortDate(rel);
            if (row.days_running !== null && row.days_running !== undefined) {
              label += ' · ' + row.days_running + 'd';
            }
            return label;
          },
          formatterParams: { html: true },
        },
        {
          title: 'Owner',
          field: 'owner',
          minWidth: 100,
          formatter: function(cell) {
            var o = cell.getValue();
            return '<span class="owner-dot" style="background:' + (colorMap[o] || '#888') + '"></span>' + o;
          },
          formatterParams: { html: true },
        },
        {
          title: 'B/E',
          field: 'breakeven',
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
      ],
    },
  ];

  if (anyReleased) {
    if (dailyCols.length > 0) {
      columns.push({
        title: 'Daily Gross (last 7 days)',
        columns: dailyCols,
      });
    }
    if (weeklyCols.length > 0) {
      columns.push({
        title: 'Weekly Gross',
        columns: weeklyCols,
      });
    }
  }

  var table = new Tabulator('#movie-table', {
    data:                  rows,
    columns:               columns,
    layout:                'fitDataFill',
    responsiveLayout:      false,
    initialSort:           [{ column: 'release_date', dir: 'asc' }],
    columnHeaderVertAlign: 'bottom',
    resizableColumns:      false,
    selectableRows:        true,
    pagination:            true,
    paginationSize:        25,
    paginationSizeSelector: [10, 25, 50, 100, true],
  });

  return { table: table, hiddenWeekCols: hiddenWeekCols };
}

// ── Owner filter ──────────────────────────────────────────────────────────
// Pure render — no internal state. Reads activeOwners array, paints buttons.
// Clicks are handled via event delegation in app.js.
// showWeekHistory / hasWeekHistory control the week-history toggle button.

export function buildOwnerFilter(owners, colorMap, activeOwners, showUnowned, showWeekHistory, hasWeekHistory) {
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

  if (hasWeekHistory) {
    var weekToggle = document.createElement('button');
    weekToggle.className = 'btn btn-sm btn-outline-secondary';
    weekToggle.textContent = showWeekHistory ? 'Hide week history' : 'Show week history';
    weekToggle.dataset.toggleWeekHistory = '1';
    container.appendChild(weekToggle);
  }

  var clear = document.createElement('button');
  clear.className = 'btn btn-sm btn-outline-secondary';
  clear.textContent = 'Clear';
  clear.dataset.clear = '1';
  container.appendChild(clear);
}
