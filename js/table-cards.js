import { fmt, formatShortDate, colorClass, pickIcon } from './utils.js';

var COOKIE_SORT = 'mb_cards_sort';

function readCookie(name) {
  var m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name, value) {
  var exp = new Date();
  exp.setFullYear(exp.getFullYear() + 1);
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + exp.toUTCString() + '; path=/; SameSite=Lax';
}

function deltaText(value, prev) {
  if (value === null || value === undefined) return null;
  if (prev === null || prev === undefined || prev === 0) return '(—)';
  var pct = Math.round((value - prev) / Math.abs(prev) * 100);
  return '(' + (pct > 0 ? '+' : '') + pct + '%)';
}

function buildRows(data) {
  var allWeekKeys = new Set();
  Object.values(data.movies).forEach(function(m) {
    Object.keys(m.weekly_gross || {}).forEach(function(w) { allWeekKeys.add(w); });
  });
  var allWeeks = Array.from(allWeekKeys).sort();
  var reversedWeeks = allWeeks.slice().reverse();

  return Object.entries(data.movies).map(function(entry) {
    var id = entry[0], m = entry[1];
    var wg = m.weekly_gross || {};
    var thisWk = reversedWeeks[0] ? (wg[reversedWeeks[0]] != null ? wg[reversedWeeks[0]] : null) : null;
    var lastWk = reversedWeeks[1] ? (wg[reversedWeeks[1]] != null ? wg[reversedWeeks[1]] : null) : null;
    var weekBefore = reversedWeeks[2] ? (wg[reversedWeeks[2]] != null ? wg[reversedWeeks[2]] : null) : null;
    return {
      imdb_id: id,
      movie_title: m.movie_title,
      owner: m.owner,
      pick_type: m.pick_type,
      release_date: m.release_date || 'TBA',
      breakeven: m.breakeven != null ? m.breakeven : null,
      to_date_profit: m.profit_td != null ? m.profit_td : null,
      roi: (m.profit_td != null && m.breakeven) ? m.profit_td / m.breakeven * 100 : null,
      this_week: thisWk,
      last_week: lastWk,
      week_before: weekBefore,
    };
  });
}

function compareBy(field) {
  return function(a, b) {
    if (field === 'release_date') return (a.release_date < b.release_date) ? -1 : (a.release_date > b.release_date ? 1 : 0);
    var av = a[field], bv = b[field];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return bv - av; // desc for numeric fields
  };
}

export function buildCards(data, colorMap, selection) {
  var container = document.getElementById('movie-cards');
  if (!container) return null;

  var sortField = readCookie(COOKIE_SORT) || 'release_date';
  var sortEl = document.getElementById('cards-sort');
  if (sortEl) {
    sortEl.value = sortField;
    sortEl.classList.remove('d-none');
  }

  var rows = buildRows(data);

  function render() {
    rows.sort(compareBy(sortField));
    var html = rows.map(function(r) {
      var color = colorMap[r.owner] || '#888';
      var profit = r.to_date_profit;
      var profitStr = (profit == null) ? '<span class="text-neu">—</span>'
        : '<span class="' + colorClass(profit) + '">' + fmt(profit) + '</span>';
      var roiStr = (r.roi == null) ? '(—)'
        : '(' + (r.roi > 0 ? '+' : '') + Math.round(r.roi) + '%)';

      function weekCell(val, prev) {
        if (val == null) return '<div class="stat-val"><span class="text-neu">—</span></div>';
        var v = '<span class="' + colorClass(val) + '">' + fmt(val) + '</span>';
        var d = deltaText(val, prev);
        return '<div class="stat-val">' + v + '</div><div class="stat-delta">' + (d || '') + '</div>';
      }

      var selected = selection.has(r.imdb_id);
      return ''
        + '<div class="movie-card' + (selected ? ' is-selected' : '') + '" data-imdb-id="' + r.imdb_id + '">'
        +   '<div class="movie-card-header">'
        +     '<div class="movie-card-title">'
        +       pickIcon(r.pick_type, r.release_date)
        +       '<span class="movie-title-text">' + r.movie_title + '</span>'
        +     '</div>'
        +     '<div class="movie-card-owner"><span class="owner-dot" style="background:' + color + '"></span>' + r.owner + '</div>'
        +     '<button class="movie-card-plot-btn" type="button" aria-label="Plot on chart" title="Plot on chart">'
        +       '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>'
        +     '</button>'
        +   '</div>'
        +   '<div class="movie-card-sub">Opened ' + (r.release_date === 'TBA' ? 'TBA' : formatShortDate(r.release_date)) + (r.breakeven ? '  ·  B/E ' + fmt(r.breakeven) : '') + '</div>'
        +   '<div class="movie-card-stats">'
        +     '<div><div class="stat-label">PROFIT</div><div class="stat-val">' + profitStr + '</div><div class="stat-delta">' + roiStr + '</div></div>'
        +     '<div><div class="stat-label">THIS WK</div>' + weekCell(r.this_week, r.last_week) + '</div>'
        +     '<div><div class="stat-label">LAST WK</div>' + weekCell(r.last_week, r.week_before) + '</div>'
        +   '</div>'
        +   '<div class="movie-card-extra d-none">'
        +     '<div class="extra-row"><span class="extra-label">2 wks ago</span>' + weekCell(r.week_before, null) + '</div>'
        +     (r.breakeven ? '<div class="extra-row"><span class="extra-label">B/E</span> ' + fmt(r.breakeven) + '</div>' : '')
        +   '</div>'
        + '</div>';
    }).join('');
    container.innerHTML = html;
  }

  render();

  if (sortEl) {
    sortEl.addEventListener('change', function() {
      sortField = sortEl.value;
      writeCookie(COOKIE_SORT, sortField);
      render();
    });
  }

  var LONG_PRESS_MS = 500;
  var pressTimer = null;
  var pressFiredLong = false;
  var pressedCard = null;

  container.addEventListener('click', function(e) {
    if (e.target.closest('.movie-card-plot-btn')) {
      var pbCard = e.target.closest('.movie-card');
      if (pbCard) selection.toggle(pbCard.dataset.imdbId);
      e.stopPropagation();
      return;
    }
    if (pressFiredLong) return; // long-press already handled
    var card = e.target.closest('.movie-card');
    if (!card) return;
    var extra = card.querySelector('.movie-card-extra');
    if (extra) extra.classList.toggle('d-none');
  });

  container.addEventListener('pointerdown', function(e) {
    if (e.target.closest('.movie-card-plot-btn')) return;
    var card = e.target.closest('.movie-card');
    if (!card) return;
    pressFiredLong = false;
    pressedCard = card;
    pressTimer = setTimeout(function() {
      pressFiredLong = true;
      selection.toggle(card.dataset.imdbId);
    }, LONG_PRESS_MS);
  });

  function clearPress() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    pressedCard = null;
    // Defer flag reset so the subsequent click handler can see it.
    setTimeout(function() { pressFiredLong = false; }, 0);
  }

  container.addEventListener('pointerup', clearPress);
  container.addEventListener('pointercancel', clearPress);
  container.addEventListener('pointerleave', clearPress);

  // Desktop right-click also plots (same as long-press)
  container.addEventListener('contextmenu', function(e) {
    var card = e.target.closest('.movie-card');
    if (!card) return;
    e.preventDefault();
    selection.toggle(card.dataset.imdbId);
  });

  return {
    rerender: render,
    syncSelection: function() {
      var ids = selection.toArray();
      Array.prototype.forEach.call(container.querySelectorAll('.movie-card'), function(el) {
        if (ids.indexOf(el.dataset.imdbId) !== -1) el.classList.add('is-selected');
        else el.classList.remove('is-selected');
      });
    },
    destroy: function() {
      container.innerHTML = '';
      if (sortEl) sortEl.classList.add('d-none');
    },
  };
}
