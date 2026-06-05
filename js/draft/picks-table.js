import { fmt, fmtPct, colorClass, pickIcon, ownerBadge } from '../utils.js';
import { picksForDraft, profitRanksForSeason } from './season-helpers.js';

var SEASON_LABEL = { WINTER: 'Winter', SUMMER: 'Summer', FALL: 'Fall' };

function profitCell(profit) {
  if (profit == null) return '<span class="text-neu">—</span>';
  return '<span class="' + colorClass(profit) + '">' + fmt(profit) + '</span>';
}

function roiCell(profit, breakeven) {
  if (profit == null || breakeven == null || breakeven === 0) {
    return '<span class="text-neu">—</span>';
  }
  var roi = profit / breakeven * 100;
  return '<span class="' + colorClass(roi) + '">' + fmtPct(roi) + '</span>';
}

function rankCell(rank) {
  if (rank == null) return '<span class="text-neu">—</span>';
  return '<span class="text-neu">#' + rank + '</span>';
}

export function buildPicksTable(data, season, colorMap, mountEl) {
  if (!mountEl) return;

  var picks = picksForDraft(data, season);

  if (!picks.length) {
    mountEl.innerHTML = '<p class="draft-empty">Draft hasn’t happened yet — check back after the picks are made.</p>';
    return;
  }

  var ranksBySeason = {
    WINTER: profitRanksForSeason(data, 'WINTER'),
    SUMMER: profitRanksForSeason(data, 'SUMMER'),
    FALL:   profitRanksForSeason(data, 'FALL'),
  };
  var rankTip = "Profit rank within the movie's release season";

  var rows = picks.map(function(m) {
    if (m.ghost) {
      var ghostTitleAttr = m.clearedTitle ? ' title="Cleared: ' + m.clearedTitle.replace(/"/g, '&quot;') + '"' : '';
      return '<tr class="draft-row-ghost draft-row-swappable" data-kind="slot-ghost"'
        + ' data-owner="' + (m.owner || '') + '"'
        + ' data-pick-type="' + (m.pick_type || '') + '"'
        + ' data-draft-pick="' + (m.draft_pick || '') + '"'
        + ' data-cleared-imdb="' + (m.clearedImdbId || '') + '"'
        + ghostTitleAttr + '>'
        + '<td class="text-end">' + m.draft_pick + '</td>'
        + '<td>' + ownerBadge(m.owner, colorMap) + '<span class="draft-row-ghost-label">— cleared —</span></td>'
        + '<td class="text-end"><span class="text-neu">—</span></td>'
        + '<td class="text-end"><span class="text-neu">—</span></td>'
        + '<td class="text-end"><span class="text-neu">—</span></td>'
        + '<td class="text-end"><span class="text-neu">—</span></td>'
        + '<td class="cell-clear"></td>'
        + '</tr>';
    }
    var pt = (m.pick_type || '').toLowerCase();
    var isLocked = (pt === 'hit' || pt === 'bomb');
    var trClasses = [];
    if (isLocked) trClasses.push('draft-row-dimmed');
    if (isLocked) trClasses.push('draft-row-locked');
    if (!isLocked) trClasses.push('draft-row-swappable');
    var classAttr = trClasses.length ? ' class="' + trClasses.join(' ') + '"' : '';
    var dataAttrs = ' data-imdb="' + m.imdb_id + '"'
      + ' data-owner="' + (m.owner || '') + '"'
      + ' data-pick-type="' + (m.pick_type || '') + '"'
      + ' data-kind="slot"';
    var rankPool = ranksBySeason[m.season] || {};
    var clearCell = isLocked
      ? '<td class="cell-clear"></td>'
      : '<td class="cell-clear"><button type="button" class="draft-clear-pick" aria-label="Clear pick">×</button></td>';
    var titleAttr = m.movie_title ? ' title="' + m.movie_title.replace(/"/g, '&quot;') + '"' : '';
    return '<tr' + classAttr + dataAttrs + '>'
      + '<td class="text-end">' + m.draft_pick + '</td>'
      + '<td class="cell-title"' + titleAttr + '>' + ownerBadge(m.owner, colorMap) + pickIcon(m.pick_type, m.release_date) + '<span class="draft-pick-title">' + m.movie_title + '</span></td>'
      + '<td class="text-end">' + (m.breakeven != null ? fmt(m.breakeven) : '<span class="text-neu">—</span>') + '</td>'
      + '<td class="text-end">' + profitCell(m.profit_td) + '</td>'
      + '<td class="text-end">' + roiCell(m.profit_td, m.breakeven) + '</td>'
      + '<td class="text-end" title="' + rankTip + '">' + rankCell(rankPool[m.imdb_id]) + '</td>'
      + clearCell
      + '</tr>';
  }).join('');

  var label = SEASON_LABEL[season] || season;
  mountEl.innerHTML = '<div class="info-tab-card draft-picks-card">'
    + '<div class="draft-unpicked-header">' + label + ' Draft Order</div>'
    + '<div class="draft-picks-wrap">'
    + '<table class="draft-picks-table">'
    + '<thead><tr>'
    +   '<th class="text-end">#</th>'
    +   '<th>Movie</th>'
    +   '<th class="text-end">B/E</th>'
    +   '<th class="text-end">Profit</th>'
    +   '<th class="text-end">ROI</th>'
    +   '<th class="text-end" title="' + rankTip + '">Rank</th>'
    +   '<th class="cell-clear" aria-hidden="true"></th>'
    + '</tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>'
    + '</div>'
    + '</div>';
}
