import {
  fmt, colorClass,
  formatShortDate, formatDayMonth, formatWeekLabel, isoWeekBounds,
  daysRunning, grossAsOf, dailyDelta,
} from './utils.js';

// ── Tabulator table ───────────────────────────────────────────────────────
// Returns the Tabulator instance.
// Tabulator (UMD global) is loaded via <script src> in index.html.

export function buildTable(data, owners, colorMap, LATEST_DATE) {

  // Collect all dates that appear in any movie's daily_gross
  var allDailyDates = new Set();
  Object.values(data.movies).forEach(function(m) {
    Object.keys(m.daily_gross || {}).forEach(function(d) { allDailyDates.add(d); });
  });
  var sortedDaily = Array.from(allDailyDates).sort();
  var last7 = sortedDaily.slice(-7);

  // Build weekly buckets (ISO calendar week Mon–Sun)
  function isoWeekKey(d) {
    var dt = new Date(d + 'T00:00:00Z');
    var day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day); // nearest Thursday
    var year = dt.getUTCFullYear();
    var week = Math.ceil(((dt - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
    return year + '-W' + String(week).padStart(2, '0');
  }

  var weekBuckets = {};
  sortedDaily.forEach(function(d) {
    var key = isoWeekKey(d);
    if (!weekBuckets[key]) weekBuckets[key] = [];
    weekBuckets[key].push(d);
  });

  var allWeeks = Object.keys(weekBuckets).sort();
  var last4Weeks = allWeeks.slice(-4);

  var anyReleased = sortedDaily.length > 0;

  // Build row data
  var rows = Object.entries(data.movies).map(function(entry) {
    var imdb_id = entry[0], movie = entry[1];
    var dg = movie.daily_gross || {};
    var toDateGross  = LATEST_DATE ? grossAsOf(dg, LATEST_DATE) : 0;
    var budget       = movie.budget || 0;
    var toDateProfit = toDateGross - 2 * budget;
    var released     = movie.release_date && LATEST_DATE && movie.release_date <= LATEST_DATE;

    var row = {
      imdb_id:        imdb_id,
      movie_title:    movie.movie_title,
      owner:          movie.owner,
      pick_type:      movie.pick_type,
      release_date:   movie.release_date || 'TBA',
      days_running:   released ? daysRunning(movie.release_date, LATEST_DATE) : null,
      budget:         budget,
      to_date_gross:  released ? toDateGross  : null,
      to_date_profit: released ? toDateProfit : null,
    };

    var last7Start = sortedDaily.length - last7.length;
    last7.forEach(function(d, i) {
      var prevIdx = last7Start + i - 1;
      var prevDate = prevIdx >= 0 ? sortedDaily[prevIdx] : null;
      if (prevDate) {
        var delta = dailyDelta(dg, d, prevDate);
        row['daily_' + d] = delta !== null ? Math.max(0, delta) : null;
      } else {
        row['daily_' + d] = dg[d] !== undefined ? Math.max(0, dg[d]) : null;
      }
    });

    last4Weeks.forEach(function(wk) {
      var dates = weekBuckets[wk];
      var total = 0, hasData = false;
      dates.forEach(function(d, i) {
        if (i === 0) return;
        var delta = dailyDelta(dg, d, dates[i - 1]);
        if (delta !== null) { total += Math.max(0, delta); hasData = true; }
      });
      row['week_' + wk] = hasData ? total : null;
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

  // Column definitions
  var titleCol = {
    title: 'Movie',
    field: 'movie_title',
    frozen: true,
    minWidth: 190,
    formatter: function(cell) {
      var row = cell.getRow().getData();
      var dot = '<span class="owner-dot" style="background:' + (colorMap[row.owner] || '#888') + '"></span>';
      var badge = '<span class="pick-badge pick-' + row.pick_type + '">' + row.pick_type + '</span>';
      return dot + cell.getValue() + ' ' + badge;
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

  var weeklyCols = last4Weeks.slice().reverse().map(function(wk, i) {
    var isLatest = (i === 0);
    var title;
    if (isLatest) {
      var b = isoWeekBounds(wk), sm = b.start.split('-'), em = b.end.split('-');
      title = sm[1] === em[1]
        ? formatShortDate(b.start) + '–' + parseInt(em[2])
        : formatShortDate(b.start) + '–' + formatShortDate(b.end);
    } else {
      title = formatWeekLabel(weekBuckets[wk]);
    }
    return {
      title: title,
      field: 'week_' + wk,
      hozAlign: 'right',
      minWidth: 90,
      cssClass: [i === 0 ? 'week-sep' : null, isLatest ? 'week-latest' : null].filter(Boolean).join(' '),
      formatter: fmtCell,
      formatterParams: { html: true },
      sorter: 'number',
    };
  });

  var columns = [
    {
      title: 'Movie Details',
      columns: [titleCol],
    },
    {
      title: 'Opening Date',
      field: 'release_date',
      minWidth: 130,
      sorter: 'string',
    },
    {
      title: 'Days',
      field: 'days_running',
      hozAlign: 'right',
      minWidth: 72,
      formatter: function(cell) {
        var v = cell.getValue();
        return v !== null && v !== undefined ? String(v) : '<span class="text-neu">—</span>';
      },
      formatterParams: { html: true },
      sorter: 'number',
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

  return new Tabulator('#movie-table', {
    data:             rows,
    columns:          columns,
    layout:           'fitDataFill',
    responsiveLayout: false,
    initialSort:      [{ column: 'release_date', dir: 'asc' }],
    columnHeaderVertAlign: 'bottom',
    resizableColumns: false,
  });
}

// ── Owner filter ──────────────────────────────────────────────────────────
// Pure render — no internal state. Reads activeOwners array, paints buttons.
// Clicks are handled via event delegation in app.js.

export function buildOwnerFilter(owners, colorMap, activeOwners) {
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

  var clear = document.createElement('button');
  clear.className = 'btn btn-sm btn-outline-secondary';
  clear.textContent = 'Clear';
  clear.dataset.clear = '1';
  container.appendChild(clear);
}
