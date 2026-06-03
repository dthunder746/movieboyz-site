var WRAPPER_ID = 'table-wrapper';

// Comfortable widths mirror the `width` values in buildCompactTable's columns.
// Budgeting by these (not min-widths) keeps each visible column wide enough to
// show its content; layout: 'fitColumns' then grows them to fill the container.
var W_TITLE = 172, W_RELEASED = 80, W_OWNER = 88, W_PROFIT = 138, W_BREAKEVEN = 88, W_WEEK = 120;
var FIXED = W_TITLE + W_RELEASED + W_OWNER + W_PROFIT;
var MAX_WEEKS = 8;   // keep Compact compact even on very wide screens
var TOO_NARROW = 440; // below this, the mode switcher falls back to Cards

export function applyCompactResponsive(table, weekFields, callbacks) {
  var wrapper = document.getElementById(WRAPPER_ID);
  if (!wrapper) return null;
  var lastNarrow = false;
  var firstRun = true;

  function apply() {
    var avail = wrapper.clientWidth;
    var tooNarrow = avail < TOO_NARROW;

    if (!tooNarrow) {
      var budget = avail - FIXED - 2;
      // Priority: this week, last week, breakeven, then progressively older weeks.
      var order = [];
      if (weekFields[0]) order.push({ key: weekFields[0], w: W_WEEK });
      if (weekFields[1]) order.push({ key: weekFields[1], w: W_WEEK });
      order.push({ key: 'breakeven', w: W_BREAKEVEN });
      for (var i = 2; i < weekFields.length && i < MAX_WEEKS; i++) {
        order.push({ key: weekFields[i], w: W_WEEK });
      }

      // Strict priority: once one column doesn't fit, drop it and everything
      // after it, so we never show a lower-priority column while hiding a
      // higher-priority one.
      var visible = {};
      var room = true;
      order.forEach(function(o) {
        if (room && budget >= o.w) { visible[o.key] = true; budget -= o.w; }
        else { visible[o.key] = false; room = false; }
      });

      if (visible['breakeven']) table.showColumn('breakeven'); else table.hideColumn('breakeven');
      weekFields.forEach(function(f) {
        if (visible[f]) table.showColumn(f); else table.hideColumn(f);
      });
    }

    if (callbacks) {
      var wasNarrow = lastNarrow;
      lastNarrow = tooNarrow;
      var fire = function() {
        if (tooNarrow && !wasNarrow) callbacks.onNarrow && callbacks.onNarrow();
        else if (!tooNarrow && wasNarrow) callbacks.onWidened && callbacks.onWidened();
      };
      // Defer the very first narrow callback so the caller finishes assigning
      // the observer and table before any re-entrant mode switch tears them down.
      if (firstRun && tooNarrow) requestAnimationFrame(fire);
      else fire();
    } else {
      lastNarrow = tooNarrow;
    }
    firstRun = false;
  }

  apply();
  var ro = new ResizeObserver(apply);
  ro.observe(wrapper);
  return ro;
}
