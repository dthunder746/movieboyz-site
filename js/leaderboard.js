import { colorClass, fmt } from './utils.js';

// ── Leaderboard ───────────────────────────────────────────────────────────

export function buildLeaderboard(data, owners, colorMap, LATEST_DATE, activeOwners) {
  var el = document.getElementById('leaderboard');
  if (!el) return;

  var activeSet = new Set(activeOwners);

  var ranked = owners.map(function(o) {
    var total = data.owners[o] && data.owners[o].total || {};
    return { owner: o, profit: LATEST_DATE && total[LATEST_DATE] !== undefined ? total[LATEST_DATE] : null };
  });
  ranked.sort(function(a, b) {
    if (a.profit === null && b.profit === null) return 0;
    if (a.profit === null) return 1;
    if (b.profit === null) return -1;
    return b.profit - a.profit;
  });

  el.innerHTML = ranked.map(function(item, idx) {
    var rankLabel = ['🥇','🥈','🥉'][idx] || (idx + 1) + '.';
    var profitHtml = '<span class="' + colorClass(item.profit) + ' fw-semibold">' + fmt(item.profit) + '</span>';
    var isActive = activeSet.has(item.owner);
    var outlineStyle = isActive
      ? 'outline:2px solid ' + colorMap[item.owner] + ';outline-offset:-1px;'
      : 'outline:none;';
    return '<div class="d-flex align-items-center gap-2 border rounded px-3 py-2"'
      + ' data-owner="' + item.owner + '" style="cursor:pointer;' + outlineStyle + '">'
      + '<span>' + rankLabel + '</span>'
      + '<span class="owner-dot" style="background:' + colorMap[item.owner] + '"></span>'
      + '<span class="fw-medium">' + item.owner + '</span>'
      + profitHtml
      + '</div>';
  }).join('');
}
