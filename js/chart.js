import { grossAsOf, fmt } from './utils.js';
import { buildMoviePalette } from './palettes.js';

// ── Chart ─────────────────────────────────────────────────────────────────
// activeMovies: imdb_id string[] (highest priority — overrides activeOwners for chart)
//   length > 0 → per-movie profit lines for exactly those movies
//
// activeOwners: string[] (used only when activeMovies is empty)
//   length 0 → all owners' cumulative profit lines
//   length 1 → per-movie profit lines for that owner
//   length 2+ → only those owners' cumulative profit lines
//
// All datasets span the full allDates range with null for pre-opening dates
// so Chart.js mode:'index' hover aligns correctly across every dataset.
//
// Returns the Chart.js instance.
// Chart (UMD global) is loaded via <script src> in index.html.

export function buildChart(data, owners, colorMap, activeOwners, activeMovies) {
  activeMovies = activeMovies || [];
  var theme   = document.documentElement.getAttribute('data-bs-theme') || 'dark';
  var gridCol = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  var tickCol = theme === 'dark' ? '#aaa' : '#555';

  // Collect all dates: owner totals + every movie profit series.
  // Movie profit series may start before the owner zero-anchor (e.g. unowned
  // movies that opened before any league pick), so we must union both sources
  // or those early dates will be silently dropped from the chart.
  var dateSet = new Set();
  owners.forEach(function(o) {
    Object.keys((data.owners[o] && data.owners[o].total) || {}).forEach(function(d) {
      dateSet.add(d);
    });
  });
  Object.values(data.movies || {}).forEach(function(m) {
    Object.keys(m.profit || {}).forEach(function(d) { dateSet.add(d); });
  });
  var allDates = Array.from(dateSet).sort();

  var datasets;

  if (activeMovies.length > 0) {
    // Selected-movies mode: exactly the rows the user picked in the table
    var selColors = buildMoviePalette(activeMovies.length);
    datasets = activeMovies.map(function(imdb_id, idx) {
      var movie      = data.movies[imdb_id];
      if (!movie) return null;
      var profit     = movie.profit || {};
      var profitKeys = Object.keys(profit).sort();
      if (!profitKeys.length) return null; // unreleased — no data yet
      var color     = selColors[idx];
      var firstDate = profitKeys[0];
      // Span full allDates; null before movie's first data point
      var points = allDates.map(function(d) {
        return { x: d, y: d >= firstDate ? grossAsOf(profit, d) / 1e6 : null };
      });
      return {
        label:            movie.movie_title,
        data:             points,
        borderColor:      color,
        backgroundColor:  color + '22',
        borderWidth:      2,
        pointRadius:      0,
        pointHoverRadius: 4,
        tension:          0.3,
        fill:             false,
        spanGaps:         false,
      };
    }).filter(Boolean);

  } else if (activeOwners.length === 1) {
    // Per-movie mode: each released movie for this owner as its own line
    var soloOwner   = activeOwners[0];
    var ownerMovies = Object.values(data.movies).filter(function(m) {
      return m.owner === soloOwner && Object.keys(m.profit || {}).length > 0;
    });
    var movieColors = buildMoviePalette(ownerMovies.length);

    datasets = ownerMovies.map(function(movie, idx) {
      var color      = movieColors[idx];
      var profit     = movie.profit || {};
      var profitKeys = Object.keys(profit).sort();
      if (!profitKeys.length) return null;
      var firstDate = profitKeys[0];
      var points = allDates.map(function(d) {
        return { x: d, y: d >= firstDate ? grossAsOf(profit, d) / 1e6 : null };
      });
      return {
        label:            movie.movie_title,
        data:             points,
        borderColor:      color,
        backgroundColor:  color + '22',
        borderWidth:      2,
        pointRadius:      0,
        pointHoverRadius: 4,
        tension:          0.3,
        fill:             false,
        spanGaps:         false,
      };
    }).filter(Boolean);

  } else {
    // 0 owners → show all; 2+ owners → show only selected
    var displayOwners = activeOwners.length === 0 ? owners : activeOwners;
    datasets = displayOwners.map(function(owner) {
      var totals = (data.owners[owner] && data.owners[owner].total) || {};
      // Span full allDates; null where owner has no data yet
      var points = allDates.map(function(d) {
        return { x: d, y: totals[d] !== undefined ? totals[d] / 1e6 : null };
      });
      return {
        label:            owner,
        data:             points,
        borderColor:      colorMap[owner],
        backgroundColor:  colorMap[owner] + '22',
        borderWidth:      2,
        pointRadius:      0,
        pointHoverRadius: 4,
        tension:          0.3,
        fill:             false,
        spanGaps:         false,
      };
    });
  }

  // Auto-trim: find the first date any dataset has a non-null, non-zero value.
  // Set the initial visible range to 7 days before that point so the chart
  // opens on meaningful data rather than a long stretch of zeros.
  var firstNonZeroDate = null;
  datasets.forEach(function(ds) {
    for (var i = 0; i < ds.data.length; i++) {
      var pt = ds.data[i];
      if (pt.y !== null && pt.y !== 0) {
        if (!firstNonZeroDate || pt.x < firstNonZeroDate) firstNonZeroDate = pt.x;
        break;
      }
    }
  });
  var xMin;
  if (firstNonZeroDate) {
    var trimD = new Date(firstNonZeroDate + 'T00:00:00Z');
    trimD.setUTCDate(trimD.getUTCDate() - 7);
    xMin = trimD.toISOString().split('T')[0];
  }

  var ctx = document.getElementById('profitChart');
  return new Chart(ctx, {
    type: 'line',
    data: { datasets: datasets },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: tickCol, boxWidth: 12, padding: 16 }
        },
        tooltip: {
          // Hide null entries (pre-opening dates) from tooltip
          filter:   function(item) { return item.parsed.y !== null; },
          itemSort: function(a, b) { return b.parsed.y - a.parsed.y; },
          callbacks: {
            label: function(ctx) {
              return ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y * 1e6);
            }
          }
        },
        zoom: {
          zoom: {
            drag:  { enabled: true },   // drag to zoom (horizontal only via mode:'x')
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode:  'x',
          },
          pan: {
            enabled:     true,
            mode:        'x',
            modifierKey: 'shift',        // shift+drag to pan
          },
          limits: {
            x: { min: 'original', max: 'original', minRange: 7 * 24 * 60 * 60 * 1000 },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          min:  xMin,                    // initial view: 7 days before first real data
          time: {
            tooltipFormat: 'MMM d, yyyy',
            displayFormats: {
              day:   'MMM d',
              week:  'MMM d',
              month: 'MMM',
              year:  'yyyy',
            },
          },
          ticks: {
            color:       tickCol,
            maxRotation: 0,
            major:       { enabled: true },
            font: function(context) {
              return context.tick && context.tick.major ? { weight: 'bold' } : {};
            },
          },
          grid: { color: gridCol },
        },
        y: {
          ticks: {
            color:    tickCol,
            callback: function(v) { return fmt(v * 1e6); }
          },
          grid: { color: gridCol },
        }
      }
    }
  });
}
