// ── Formatting helpers ────────────────────────────────────────────────────

export function fmt(v) {
  if (v === null || v === undefined) return '—';
  var abs = Math.abs(v), B = 1e9, M = 1e6, K = 1e3;
  var sign = v < 0 ? '-' : '';
  if (abs >= B)  return sign + '$' + (abs / B).toFixed(3) + 'b';
  if (abs >= M)  return sign + '$' + (abs / M).toFixed(1) + 'm';
  if (abs >= K)  return sign + '$' + Math.round(abs / K) + 'k';
  return sign + '$' + Math.round(abs);
}

export function fmtPct(v) {
  var sign = v >= 0 ? '+' : '';
  return sign + v.toFixed(1) + '%';
}

export function colorClass(v) {
  if (v === null || v === undefined) return 'text-neu';
  return v > 0 ? 'text-pos' : v < 0 ? 'text-neg' : 'text-neu';
}

export function ratingColorClass(v) {
  if (v === null || v === undefined) return 'text-neu';
  if (v >= 70) return 'text-pos';
  if (v < 50)  return 'text-neg';
  return 'text-neu';
}

export function formatShortDate(d) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var parts = d.split('-');
  return months[parseInt(parts[1]) - 1] + ' ' + parseInt(parts[2]);
}

export function formatDayMonth(d) {
  var parts = d.split('-');
  return parts[2] + '/' + parts[1];
}

export function getWeekdayAbbr(d) {
  var day = new Date(d + 'T00:00:00Z').getUTCDay();
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][day];
}


export function isoWeekBounds(weekKey) {
  // Returns { start, end } as YYYY-MM-DD for the Mon–Sun of the given ISO week key
  var parts = weekKey.split('-W');
  var year = parseInt(parts[0]), week = parseInt(parts[1]);
  var jan4 = new Date(Date.UTC(year, 0, 4));
  var day = jan4.getUTCDay() || 7;
  var w1Mon = new Date(jan4.getTime() - (day - 1) * 86400000);
  var wMon  = new Date(w1Mon.getTime() + (week - 1) * 7 * 86400000);
  var wSun  = new Date(wMon.getTime() + 6 * 86400000);
  function iso(dt) {
    return dt.getUTCFullYear() + '-'
      + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-'
      + String(dt.getUTCDate()).padStart(2, '0');
  }
  return { start: iso(wMon), end: iso(wSun) };
}

export function weekTitle(wk) {
  var b = isoWeekBounds(wk);
  var sm = b.start.split('-'), em = b.end.split('-');
  return sm[1] === em[1]
    ? formatShortDate(b.start) + '–' + parseInt(em[2])
    : formatShortDate(b.start) + '–' + formatShortDate(b.end);
}

export function dateToIsoWeekKey(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  var day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  // Thursday of this week determines the ISO year
  var thursday = new Date(d.getTime() + (4 - day) * 86400000);
  var year = thursday.getUTCFullYear();
  // Monday of ISO week 1 for that year
  var jan4 = new Date(Date.UTC(year, 0, 4));
  var jan4day = jan4.getUTCDay() || 7;
  var w1Mon = new Date(jan4.getTime() - (jan4day - 1) * 86400000);
  // Monday of the input date's week
  var monday = new Date(d.getTime() - (day - 1) * 86400000);
  var weekNum = 1 + Math.round((monday.getTime() - w1Mon.getTime()) / (7 * 86400000));
  return year + '-W' + String(weekNum).padStart(2, '0');
}

export function fmtTimestamp(d) {
  if (typeof d === 'string') {
    // "2026-02-22 18:30:00" → "26-02-22 18:30:00" (already in local TZ)
    return d.substring(2);
  }
  // Date object — render in browser local time
  var yy = String(d.getFullYear()).slice(-2);
  var mo = String(d.getMonth() + 1).padStart(2, '0');
  var dy = String(d.getDate()).padStart(2, '0');
  var hh = String(d.getHours()).padStart(2, '0');
  var mn = String(d.getMinutes()).padStart(2, '0');
  var ss = String(d.getSeconds()).padStart(2, '0');
  return yy + '-' + mo + '-' + dy + ' ' + hh + ':' + mn + ':' + ss;
}

export function fmtRelativeAgo(from) {
  var dt;
  if (from instanceof Date) {
    dt = from;
  } else if (typeof from === 'string') {
    dt = new Date(from.replace(' ', 'T'));
  } else {
    return '';
  }
  if (isNaN(dt.getTime())) return '';

  var diffMs = Date.now() - dt.getTime();
  if (diffMs < 0) diffMs = 0;

  var totalMins  = Math.floor(diffMs / 60000);
  var totalHours = Math.floor(diffMs / 3600000);
  var totalDays  = Math.floor(diffMs / 86400000);

  if (totalMins < 1)  return 'just now';
  if (totalMins < 60) return totalMins + 'mins ago';
  if (totalHours < 24) {
    var mins = totalMins - totalHours * 60;
    return mins > 0
      ? totalHours + 'hrs ' + mins + 'mins ago'
      : totalHours + 'hrs ago';
  }
  var hrs = totalHours - totalDays * 24;
  return hrs > 0
    ? totalDays + 'days ' + hrs + 'hrs ago'
    : totalDays + 'days ago';
}

export function grossAsOf(daily_gross, targetDate) {
  if (!daily_gross) return 0;
  var dates = Object.keys(daily_gross).filter(function(d) { return d <= targetDate; }).sort();
  if (!dates.length) return 0;
  return daily_gross[dates[dates.length - 1]] || 0;
}


// ── Lucide pick-type icons (inline SVG, 11×11) ────────────────────────────
export var PICK_ICONS = {
  hit:    '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  winter: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>',
  summer: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  fall:   '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
  bomb:   '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="9"/><path d="m19.5 9.5 1.8-1.8a2.4 2.4 0 0 0 0-3.4l-1.6-1.6a2.4 2.4 0 0 0-3.4 0l-1.8 1.8"/><path d="m22 2-1.5 1.5"/></svg>',
};

export function seasonFromDate(releaseDate) {
  if (!releaseDate) return 'winter';
  var month = parseInt(releaseDate.split('-')[1], 10);
  if (month <= 4) return 'winter';
  if (month <= 8) return 'summer';
  return 'fall';
}

export function pickIcon(pickType, releaseDate) {
  if (!pickType) return '';
  var key = pickType.toLowerCase();
  if (key === 'seasonal') key = seasonFromDate(releaseDate);
  return PICK_ICONS[key] ? '<span class="scorecard-pick-icon">' + PICK_ICONS[key] + '</span>' : '';
}

// Every movie gets a symbol: a picked movie uses its pick-type icon, an
// unpicked one falls back to its release season (matches info-cards).
export function pickOrSeasonIcon(pickType, releaseDate) {
  var date = (releaseDate && releaseDate !== 'TBA') ? releaseDate : null;
  var type = pickType || (date ? 'seasonal' : null);
  return pickIcon(type, date);
}

// Owners share first initials, so badges use first + last name initials.
export var OWNER_INITIALS = {
  Chris: 'CM', Connie: 'CL', Emerson: 'EB', Marcus: 'MH', Matt: 'MW',
};

// Coloured circle with the owner's initials; unowned movies get a grey circle
// with a dash.
export function ownerBadge(owner, colorMap) {
  var unowned = !owner || owner === 'none';
  var color = unowned ? '#6c757d' : ((colorMap && colorMap[owner]) || '#888');
  var glyph = unowned ? '–' : (OWNER_INITIALS[owner] || owner.charAt(0).toUpperCase());
  return '<span class="owner-badge" style="background:' + color + '">' + glyph + '</span>';
}
