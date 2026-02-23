// ── Colour palettes ───────────────────────────────────────────────────────

// Owner lines — muted Tableau-style
export var PALETTE = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f',
                      '#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac'];

// Per-movie lines — vivid/saturated, clearly distinct from owner lines
export var MOVIE_PALETTE = [
  '#ff595e','#ff924c','#ffca3a','#8ac926','#1982c4',
  '#6a4c93','#ff70a6','#70d6ff','#06d6a0','#ffd166',
  '#ef476f','#118ab2','#ffd60a','#9d4edd','#f72585',
  '#b5179e','#7209b7','#3a0ca3','#4361ee','#4cc9f0',
];

export function buildMoviePalette(n) {
  var colors = [];
  for (var i = 0; i < n; i++) {
    colors.push(MOVIE_PALETTE[i % MOVIE_PALETTE.length]);
  }
  return colors;
}

export function buildColorMap(owners) {
  var map = {};
  owners.forEach(function(o, i) { map[o] = PALETTE[i % PALETTE.length]; });
  return map;
}
