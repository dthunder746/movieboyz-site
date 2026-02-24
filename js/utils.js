// ── Formatting helpers ────────────────────────────────────────────────────

export function fmt(v) {
  if (v === null || v === undefined) return '—';
  var abs = Math.abs(v), M = 1e6, K = 1e3;
  var sign = v < 0 ? '-' : '';
  if (abs >= M)  return sign + '$' + (abs / M).toFixed(1) + 'm';
  if (abs >= K)  return sign + '$' + Math.round(abs / K) + 'k';
  return sign + '$' + Math.round(abs);
}

export function colorClass(v) {
  if (v === null || v === undefined) return 'text-neu';
  return v > 0 ? 'text-pos' : v < 0 ? 'text-neg' : 'text-neu';
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


export function grossAsOf(daily_gross, targetDate) {
  if (!daily_gross) return 0;
  var dates = Object.keys(daily_gross).filter(function(d) { return d <= targetDate; }).sort();
  if (!dates.length) return 0;
  return daily_gross[dates[dates.length - 1]] || 0;
}

