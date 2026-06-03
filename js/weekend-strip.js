import * as htmlToImage from 'html-to-image';
import { fmt, fmtPct, colorClass, pickIcon } from './utils.js';

// 9×9 bomb icon used inline in the ROI stat label
var BOMB_ICON_SM = '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="9"/><path d="m19.5 9.5 1.8-1.8a2.4 2.4 0 0 0 0-3.4l-1.6-1.6a2.4 2.4 0 0 0-3.4 0l-1.8 1.8"/><path d="m22 2-1.5 1.5"/></svg>';

// ── Cookie helpers ────────────────────────────────────────────────────────
function readCollapsedCookie() {
  var match = document.cookie.match(/(?:^|;)\s*scorecard_collapsed=([^;]*)/);
  if (!match) return null;
  try { return JSON.parse(decodeURIComponent(match[1])); } catch(e) { return null; }
}

function writeCollapsedCookie(state) {
  var exp = new Date();
  exp.setFullYear(exp.getFullYear() + 1);
  document.cookie = 'scorecard_collapsed=' + encodeURIComponent(JSON.stringify(state))
    + '; expires=' + exp.toUTCString() + '; path=/; SameSite=Lax';
}

async function captureAndShare(card) {
  var PIXEL_RATIO = 2;
  var RADIUS = 8 * PIXEL_RATIO; // matches .scorecard-card border-radius: 8px
  var dataUrl = await htmlToImage.toPng(card, { pixelRatio: PIXEL_RATIO, backgroundColor: null });

  // Post-process: clip to rounded rect so corners are transparent in the output PNG.
  var img = new Image();
  img.src = dataUrl;
  await new Promise(function(res) { img.onload = res; });
  var canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  var ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, RADIUS);
  ctx.clip();
  ctx.drawImage(img, 0, 0);
  dataUrl = canvas.toDataURL('image/png');

  var blob = await (await fetch(dataUrl)).blob();
  var file = new File([blob], 'scorecard.png', { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'MovieBoyz Scorecard' });
    return;
  }

  if (navigator.clipboard && navigator.clipboard.write) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return;
  }

  var a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'scorecard.png';
  a.click();
}

export function buildWeekendStrip(data, owners, colorMap) {
  var el = document.getElementById('weekend-strip');
  if (!el) return;

  // ── Week key resolution ──────────────────────────────────────────────────
  var allWeekKeys = new Set();
  Object.values(data.movies).forEach(function(m) {
    Object.keys(m.weekly_gross || {}).forEach(function(w) { allWeekKeys.add(w); });
  });
  var sortedWeeks = Array.from(allWeekKeys).sort();
  if (!sortedWeeks.length) { el.classList.add('d-none'); return; }

  // ── LATEST_DATE ──────────────────────────────────────────────────────────
  var allDates = new Set();
  Object.values(data.owners || {}).forEach(function(od) {
    Object.keys(od.total || {}).forEach(function(d) { allDates.add(d); });
  });
  var sortedDates = Array.from(allDates).sort();
  if (!sortedDates.length) { el.classList.add('d-none'); return; }
  var LATEST_DATE = sortedDates[sortedDates.length - 1];

  // ── Rank map — ordered by total[LATEST_DATE] descending ──────────────────
  var ranked = owners.slice().sort(function(a, b) {
    var av = ((data.owners[a] || {}).total || {})[LATEST_DATE];
    var bv = ((data.owners[b] || {}).total || {})[LATEST_DATE];
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });
  var rankMap = {};
  ranked.forEach(function(o, i) { rankMap[o] = i + 1; });

  // ── Collapsed state — default only #1 card open; cookie overrides per owner ──
  var cookieState = readCollapsedCookie();
  function isOpen(owner) {
    if (cookieState && Object.prototype.hasOwnProperty.call(cookieState, owner)) {
      return cookieState[owner] === true;
    }
    return rankMap[owner] === 1;
  }

  // ── Stat cell helper ─────────────────────────────────────────────────────
  // labelHtml may contain HTML (e.g. inline SVG for bomb icon in ROI label)
  function statCell(val, labelHtml, format) {
    var displayVal, cls;
    if (val === null || val === undefined) {
      displayVal = '—';
      cls = 'text-neu';
    } else if (format === 'pct') {
      displayVal = fmtPct(val);
      cls = colorClass(val);
    } else if (format === 'signed') {
      displayVal = (val > 0 ? '+' : '') + fmt(val);
      cls = colorClass(val);
    } else {
      displayVal = fmt(val);
      cls = colorClass(val);
    }
    return '<div class="scorecard-stat">'
      + '<div class="scorecard-stat-value ' + cls + '">' + displayVal + '</div>'
      + '<div class="scorecard-stat-label">' + labelHtml + '</div>'
      + '</div>';
  }

  // ── Build cards ──────────────────────────────────────────────────────────
  var html = '<div class="scorecard-strip">';

  ranked.forEach(function(owner) {
    var od = data.owners[owner] || {};
    var ownerMovies = Object.values(data.movies).filter(function(m) { return m.owner === owner; });
    var open = isOpen(owner);

    // Season total (header right)
    var season = (od.total || {})[LATEST_DATE];
    season = season != null ? season : null;

    // Stat grid
    var picksTotal = (od.picks_profit || {})[LATEST_DATE];
    picksTotal = picksTotal != null ? picksTotal : null;
    var bombImpact = (od.bomb_impact || {})[LATEST_DATE];
    bombImpact = bombImpact != null ? bombImpact : null;
    // Average Letterboxd rating across released movies that have a score
    var letterboxdScores = ownerMovies
      .filter(function(m) { return m.days_running != null; })
      .map(function(m) { return m.ratings && m.ratings.letterboxd && m.ratings.letterboxd.score; })
      .filter(function(s) { return s != null; });
    var avgLetterboxd = letterboxdScores.length
      ? letterboxdScores.reduce(function(a, b) { return a + b; }, 0) / letterboxdScores.length
      : null;

    // ROI excl. bombs: picks_profit / sum(non-bomb breakeven) * 100
    var totalBreakeven = 0;
    ownerMovies.forEach(function(m) {
      if (m.pick_type && m.pick_type.toLowerCase() !== 'bomb' && m.breakeven != null) {
        totalBreakeven += m.breakeven;
      }
    });
    var roi = (picksTotal !== null && totalBreakeven > 0) ? picksTotal / totalBreakeven * 100 : null;

    // ── Header ──────────────────────────────────────────────────────────────
    var seasonHtml = season !== null
      ? '<span class="scorecard-season-total ' + colorClass(season) + '">' + fmt(season) + '</span>'
      : '<span class="scorecard-season-total text-neu">—</span>';

    var headerHtml = '<div class="scorecard-header" data-owner="' + owner + '">'
      + '<div class="scorecard-header-left">'
      + '<span class="scorecard-toggle-icon"></span>'
      + '<span class="owner-dot" style="background:' + colorMap[owner] + '"></span>'
      + '<div>'
      + '<div class="scorecard-owner-name">' + owner + '</div>'
      + '<div class="scorecard-owner-rank">#' + rankMap[owner] + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="scorecard-header-right">'
      + seasonHtml
      + '<div class="scorecard-season-label">Season Total</div>'
      + '</div>'
      + '</div>';

    // ── Stat grid ────────────────────────────────────────────────────────────
    var letterboxdLogo = '<img src="https://www.google.com/s2/favicons?domain=letterboxd.com&sz=32" width="14" height="14" style="vertical-align:middle;margin-left:2px" alt="Letterboxd">';
    var ratingValueHtml = avgLetterboxd !== null
      ? '<div class="scorecard-stat-value">' + (avgLetterboxd / 20).toFixed(1) + '/5' + letterboxdLogo + '</div>'
      : '<div class="scorecard-stat-value text-neu">—</div>';
    var ratingCellHtml = '<div class="scorecard-stat">'
      + ratingValueHtml
      + '<div class="scorecard-stat-label">Average Rating</div>'
      + '</div>';

    var statGridHtml = '<div class="scorecard-stats">'
      + statCell(picksTotal,  'Picks Total',                     'plain')
      + statCell(bombImpact,  'Bomb Impact',                     'plain')
      + ratingCellHtml
      + statCell(roi,         'ROI excl. ' + BOMB_ICON_SM,       'pct')
      + '</div>';

    // ── Movie table (all released movies, sorted by release date) ─────────────
    var releasedMovies = ownerMovies.filter(function(m) {
      return m.release_date && m.release_date !== 'TBA' && m.release_date <= LATEST_DATE;
    }).sort(function(a, b) { return a.release_date < b.release_date ? -1 : 1; });

    var movieTableHtml;
    if (!releasedMovies.length) {
      movieTableHtml = '<div class="scorecard-movies"><div class="scorecard-no-movies">No movies released yet</div></div>';
    } else {
      var tableRows = releasedMovies.map(function(m) {
        var profitTd = m.profit_td != null ? m.profit_td : null;
        return '<tr>'
          + '<td>' + pickIcon(m.pick_type, m.release_date) + m.movie_title + '</td>'
          + '<td>' + (m.breakeven != null ? fmt(m.breakeven) : '<span class="text-neu">—</span>') + '</td>'
          + '<td>' + (m.gross_td != null ? fmt(m.gross_td) : '<span class="text-neu">—</span>') + '</td>'
          + '<td class="' + colorClass(profitTd) + '">' + fmt(profitTd) + '</td>'
          + '</tr>';
      }).join('');
      movieTableHtml = '<div class="scorecard-movies">'
        + '<table class="scorecard-movie-table">'
        + '<thead><tr>'
        + '<th>Movie</th>'
        + '<th>B/E</th>'
        + '<th><span class="d-none d-sm-inline">Gross TD</span><span class="d-inline d-sm-none">Gr.</span></th>'
        + '<th><span class="d-none d-sm-inline">Profit TD</span><span class="d-inline d-sm-none">Pr.</span></th>'
        + '</tr></thead>'
        + '<tbody>' + tableRows + '</tbody>'
        + '</table>'
        + '</div>';
    }

    // ── Footer (next unreleased pick) ─────────────────────────────────────────
    var upcoming = ownerMovies.filter(function(m) {
      return m.release_date && m.release_date !== 'TBA' && m.release_date > LATEST_DATE;
    }).sort(function(a, b) { return a.release_date < b.release_date ? -1 : 1; });
    var nextMovie = upcoming.length ? upcoming[0] : null;
    var daysUntil = nextMovie
      ? Math.ceil((new Date(nextMovie.release_date + 'T00:00:00Z')
                   - new Date(LATEST_DATE + 'T00:00:00Z')) / 86400000)
      : null;

    var nextTitleHtml = nextMovie
      ? '<div class="scorecard-next-title" title="' + nextMovie.movie_title + '">'
          + '<span class="scorecard-next-title-text">'
          + pickIcon(nextMovie.pick_type, nextMovie.release_date) + nextMovie.movie_title
          + '</span>'
          + (daysUntil !== null
              ? '<span class="scorecard-next-days-badge">' + daysUntil + 'd</span>'
              : '')
          + '</div>'
      : '<div class="scorecard-next-title"><span class="scorecard-next-title-text">None scheduled</span></div>';

    var footerHtml = '<div class="scorecard-footer">'
      + '<div class="scorecard-footer-left">'
      + '<div class="scorecard-next-label">Next</div>'
      + nextTitleHtml
      + '</div>'
      + '<button class="scorecard-share-btn" title="Share card" aria-label="Share card">'
      + '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>'
      + '<polyline points="16 6 12 2 8 6"/>'
      + '<line x1="12" y1="2" x2="12" y2="15"/>'
      + '</svg>'
      + '</button>'
      + '</div>';

    // ── Assemble card ─────────────────────────────────────────────────────────
    html += '<div class="scorecard-card' + (open ? ' is-open' : '') + '"'
      + ' style="border-top:3px solid ' + colorMap[owner] + ';--scorecard-hover-bg:color-mix(in srgb,' + colorMap[owner] + ' 15%,transparent)">'
      + headerHtml
      + '<div class="scorecard-body">'
      + statGridHtml
      + movieTableHtml
      + footerHtml
      + '</div>'
      + '</div>';
  });

  html += '</div>';
  el.classList.remove('d-none');
  el.innerHTML = html;

  // ── Collapse toggle ───────────────────────────────────────────────────────
  el.addEventListener('click', function(e) {
    var shareBtn = e.target.closest('.scorecard-share-btn');
    if (shareBtn) {
      e.stopPropagation();
      var card = shareBtn.closest('.scorecard-card');
      var originalHtml = shareBtn.innerHTML;
      captureAndShare(card).then(function() {
        shareBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(function() { shareBtn.innerHTML = originalHtml; }, 1500);
      }).catch(function(err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      });
      return;
    }

    var header = e.target.closest('.scorecard-header');
    if (!header) return;
    var card = header.closest('.scorecard-card');
    if (!card) return;
    card.classList.toggle('is-open');
    var state = readCollapsedCookie() || {};
    state[header.dataset.owner] = card.classList.contains('is-open');
    writeCollapsedCookie(state);
  });
}
