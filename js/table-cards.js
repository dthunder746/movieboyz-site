import { fmt, formatShortDate, colorClass, ratingColorClass, pickOrSeasonIcon, ownerBadge } from './utils.js';

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

// Mini gross-by-week bars (oldest → newest, most recent week emphasised).
function sparkline(weeks, color) {
  if (!weeks || weeks.length < 2) return '';
  var vals = weeks.map(function(w) { return w.gross || 0; });
  var max = Math.max.apply(null, vals);
  if (max <= 0) return '';
  var W = 140, H = 30, n = vals.length, gap = n > 24 ? 1 : 2;
  var bw = (W - gap * (n - 1)) / n;
  var bars = vals.map(function(v, i) {
    var h = Math.max(1.5, (v / max) * H);
    var x = i * (bw + gap);
    var last = i === n - 1;
    return '<rect x="' + x.toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + bw.toFixed(1) +
      '" height="' + h.toFixed(1) + '" rx="0.6" fill="' + color + '" opacity="' + (last ? 1 : 0.5) + '"/>';
  }).join('');
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + bars + '</svg>';
}

// Diverging ROI meter: centre tick = break-even (0% ROI). Loss side is bounded
// at −100% (can't lose more than the outlay) and fills toward the left. Profit
// side: 0→+100% fills green to the +100% mark (always-visible tick at 85%).
// Anything past +100% is shown as a breakout chevron fill in the lane — never
// more solid bar. The fill's length is log-scaled, so it just clears the cap at
// modest ROI and reaches the bar's end at +10000%.
var ROI_CENTER = 50;    // break-even, visual %
var ROI_CAP = 85;       // +100% mark, visual % (green fill stops here)
var ROI_BREAK = 100;    // ROI% at the cap; beyond this is breakout chevrons
var ROI_MAX = 10000;    // ROI% whose chevron fill reaches the bar's end (log-scaled)
function roiMeter(roi) {
  if (roi === null || roi === undefined) return '';
  var pos = roi >= 0;
  var fillW = pos
    ? Math.min(roi, ROI_BREAK) / ROI_BREAK * (ROI_CAP - ROI_CENTER)
    : Math.min(Math.abs(roi), 100) / 100 * ROI_CENTER;
  var arrows = '';
  if (roi > ROI_BREAK) {
    var laneFrac = Math.min(1, (Math.log(roi) - Math.log(ROI_BREAK)) / (Math.log(ROI_MAX) - Math.log(ROI_BREAK)));
    var laneW = (laneFrac * (100 - ROI_CAP)).toFixed(1); // % of bar, cap → end
    arrows = '<span class="roi-over" style="width:' + laneW + '%"></span>';
  }
  return '<div class="roi-meter">'
    +   '<div class="roi-bar"><span class="roi-bar-fill ' + (pos ? 'pos' : 'neg') + '" style="width:' + fillW.toFixed(1) + '%"></span></div>'
    +   '<span class="roi-tick"></span>'
    +   '<span class="roi-cap"></span>'
    +   arrows
    +   '<div class="roi-scale"><span class="s-min">-100%</span><span class="s-be">break-even</span><span class="s-max">+100%</span></div>'
    + '</div>';
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
    // This movie's own weekly gross series, oldest → newest, for the sparkline
    // and the expanded week-by-week list.
    var weeks = Object.keys(wg).sort().map(function(k) {
      return { num: parseInt(k.split('-W')[1], 10), gross: wg[k] != null ? wg[k] : 0 };
    });
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
      weeks: weeks,
      rating_lb: (m.ratings && m.ratings.letterboxd && m.ratings.letterboxd.score != null) ? m.ratings.letterboxd.score : null,
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

  // Profit rank across all movies that have profit data.
  var ranked = rows.filter(function(r) { return r.to_date_profit != null; })
    .slice().sort(function(a, b) { return b.to_date_profit - a.to_date_profit; });
  ranked.forEach(function(r, i) { r.rank = i + 1; });
  var rankTotal = ranked.length;

  function render() {
    rows.sort(compareBy(sortField));
    var html = rows.map(function(r) {
      var unowned = !r.owner || r.owner === 'none';
      var ownerColor = unowned ? '#6c757d' : (colorMap[r.owner] || '#888');
      var ownerName = unowned ? 'Unowned' : r.owner;
      var profit = r.to_date_profit;
      var profitStr = (profit == null) ? '—' : fmt(profit);
      var profitCls = (profit == null) ? 'text-neu' : colorClass(profit);
      var roiChip = (r.roi == null) ? ''
        : '<span class="roi-chip ' + colorClass(r.roi) + '">' + (r.roi > 0 ? '+' : '') + Math.round(r.roi) + '%</span>';

      // Weekly mini-table (Δ% vs the previous, older week), newest first.
      var asc = r.weeks;
      var weekBody = asc.map(function(w, i) {
        var prev = i > 0 ? asc[i - 1].gross : null;
        var dCell;
        if (prev === null || prev === 0) {
          dCell = '<td class="wk-delta text-neu">—</td>';
        } else {
          var pct = Math.round((w.gross - prev) / Math.abs(prev) * 100);
          dCell = '<td class="wk-delta ' + colorClass(pct) + '">' + (pct > 0 ? '+' : '') + pct + '%</td>';
        }
        return '<tr><td>#' + w.num + '</td><td>' + fmt(w.gross) + '</td>' + dCell + '</tr>';
      }).reverse().join('');
      var weekTable = weekBody
        ? '<table class="week-table"><thead><tr><th>Week</th><th>Gross</th><th>Δ%</th></tr></thead><tbody>' + weekBody + '</tbody></table>'
        : '<div class="extra-empty">No weekly data yet</div>';
      var rankLine = r.rank
        ? '<div class="extra-rank">Profit rank <strong>#' + r.rank + '</strong> of ' + rankTotal + '</div>'
        : '';
      var spark = sparkline(r.weeks, ownerColor);
      var ratingChip = (r.rating_lb == null) ? ''
        : '<span class="rating-chip ' + ratingColorClass(r.rating_lb) + '"><img class="rating-icon" src="https://www.google.com/s2/favicons?domain=letterboxd.com&sz=32" alt="Letterboxd" width="14" height="14">' + (r.rating_lb / 20).toFixed(1) + '</span>';
      var metaBE = r.breakeven ? '  ·  B/E ' + fmt(r.breakeven) : '';

      var selected = selection.has(r.imdb_id);
      return ''
        + '<div class="movie-card' + (selected ? ' is-selected' : '') + (unowned ? ' is-unowned' : '') + '" data-imdb-id="' + r.imdb_id + '" style="--owner:' + ownerColor + '">'
        +   '<div class="movie-card-header">'
        +     '<div class="movie-card-title">'
        +       pickOrSeasonIcon(r.pick_type, r.release_date)
        +       '<span class="movie-title-text">' + r.movie_title + '</span>'
        +     '</div>'
        +     ownerBadge(r.owner, colorMap)
        +     '<button class="movie-card-plot-btn" type="button" aria-label="Plot on chart" title="Plot on chart">'
        +       '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>'
        +     '</button>'
        +   '</div>'
        +   '<div class="movie-card-meta">' + ownerName + '  ·  Opened ' + (r.release_date === 'TBA' ? 'TBA' : formatShortDate(r.release_date)) + metaBE + '</div>'
        +   '<div class="movie-card-hero">'
        +     '<span class="hero-profit ' + profitCls + '">' + profitStr + '</span>'
        +     roiChip
        +     ratingChip
        +   '</div>'
        +   roiMeter(r.roi)
        +   (spark ? '<div class="movie-card-spark">' + spark + '</div>' : '')
        +   '<div class="movie-card-extra d-none">'
        +     rankLine
        +     weekTable
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
