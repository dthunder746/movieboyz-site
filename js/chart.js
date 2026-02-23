import { grossAsOf, fmt } from './utils.js';
import { buildMoviePalette } from './palettes.js';

// ── Chart ─────────────────────────────────────────────────────────────────
// activeOwners: string[]
//   length 0 → all owners' cumulative profit lines
//   length 1 → per-movie profit lines for that owner
//   length 2+ → only those owners' cumulative profit lines
//
// Returns the Chart.js instance.
// Chart (UMD global) is loaded via <script src> in index.html.

export function buildChart(data, owners, colorMap, activeOwners) {
  var theme   = document.documentElement.getAttribute('data-bs-theme') || 'dark';
  var gridCol = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  var tickCol = theme === 'dark' ? '#aaa' : '#555';

  // Collect all dates across all owners
  var dateSet = new Set();
  owners.forEach(function(o) {
    Object.keys((data.owners[o] && data.owners[o].total) || {}).forEach(function(d) {
      dateSet.add(d);
    });
  });
  var allDates = Array.from(dateSet).sort();

  var datasets;

  if (activeOwners.length === 1) {
    // Per-movie mode: each released movie for this owner as its own line
    var soloOwner  = activeOwners[0];
    var latestDate = allDates[allDates.length - 1] || '';
    var ownerMovies = Object.values(data.movies).filter(function(m) {
      return m.owner === soloOwner && m.release_date && m.release_date <= latestDate;
    });
    var movieColors = buildMoviePalette(ownerMovies.length);

    datasets = ownerMovies.map(function(movie, idx) {
      var color  = movieColors[idx];
      var dg     = movie.daily_gross || {};
      var budget = movie.budget || 0;
      var rel    = movie.release_date;

      // Pad dates before release with 0 so all datasets share the same x-range
      // (keeps mode:'index' tooltip correctly aligned across movies)
      var points = allDates.map(function(d) {
        var y = d < rel ? 0 : (grossAsOf(dg, d) - 2 * budget) / 1e6;
        return { x: d, y: y };
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
        spanGaps:         true,
      };
    });

  } else {
    // 0 owners → show all; 2+ owners → show only selected
    var displayOwners = activeOwners.length === 0 ? owners : activeOwners;
    datasets = displayOwners.map(function(owner) {
      var totals = (data.owners[owner] && data.owners[owner].total) || {};
      var points = allDates
        .filter(function(d) { return totals[d] !== undefined; })
        .map(function(d) { return { x: d, y: totals[d] / 1e6 }; });
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
        spanGaps:         true,
      };
    });
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
          itemSort: function(a, b) { return b.parsed.y - a.parsed.y; },
          callbacks: {
            label: function(ctx) {
              return ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y * 1e6);
            }
          }
        },
        zoom: {
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode:  'x',
          },
          pan: {
            enabled: true,
            mode:    'x',
          },
          limits: {
            x: { min: 'original', max: 'original', minRange: 7 * 24 * 60 * 60 * 1000 },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
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
            // Bold font on major ticks (month boundaries)
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
