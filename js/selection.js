export function createSelection(onChange) {
  var ids = new Set();
  return {
    has: function(id) { return ids.has(id); },
    toArray: function() { return Array.from(ids); },
    size: function() { return ids.size; },
    add: function(id) {
      if (ids.has(id)) return;
      ids.add(id);
      onChange(Array.from(ids));
    },
    remove: function(id) {
      if (!ids.has(id)) return;
      ids.delete(id);
      onChange(Array.from(ids));
    },
    toggle: function(id) {
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      onChange(Array.from(ids));
    },
    clear: function() {
      if (ids.size === 0) return;
      ids.clear();
      onChange([]);
    },
    set: function(arr) {
      ids = new Set(arr);
      onChange(Array.from(ids));
    },
  };
}
