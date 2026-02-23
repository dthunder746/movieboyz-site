// ── Filter state manager ──────────────────────────────────────────────────
// Generic multi-select toggle state. onChange(activeArray) fires on every change.

export function createOwnerFilter(onChange) {
  var activeSet = new Set();
  return {
    toggle: function(item) {
      if (activeSet.has(item)) activeSet.delete(item);
      else activeSet.add(item);
      onChange(Array.from(activeSet));
    },
    clear: function() {
      activeSet.clear();
      onChange([]);
    },
    isActive:  function(item) { return activeSet.has(item); },
    getActive: function()     { return Array.from(activeSet); },
  };
}
