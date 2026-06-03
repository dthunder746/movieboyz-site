// ── Filter state ───────────────────────────────────────────────────────────
// Single source of truth for all filter dimensions. Pure state, no DOM.
// Other modules subscribe via onChange and read snapshots / call filter().

var DEFAULT = {
  search:        '',
  owners:        null,    // null = all owners (default). Set of owner names = active filter.
  pickTypes:     null,    // null = none selected (default = all show). Set of types.
  releaseFrom:   '',
  releaseTo:     '',
  released:      'all',   // 'all' | 'released' | 'upcoming'
  profitability: 'all',   // 'all' | 'profitable' | 'red'
  showUnowned:   false,
};

function clone(state) {
  return {
    search:        state.search,
    owners:        state.owners ? new Set(state.owners) : null,
    pickTypes:     state.pickTypes ? new Set(state.pickTypes) : null,
    releaseFrom:   state.releaseFrom,
    releaseTo:     state.releaseTo,
    released:      state.released,
    profitability: state.profitability,
    showUnowned:   state.showUnowned,
  };
}

function isDefault(state) {
  return state.search === '' &&
         state.owners === null &&
         state.pickTypes === null &&
         state.releaseFrom === '' &&
         state.releaseTo === '' &&
         state.released === 'all' &&
         state.profitability === 'all' &&
         state.showUnowned === false;
}

function activeDimensionCount(state) {
  var n = 0;
  if (state.search !== '') n++;
  if (state.owners !== null) n++;
  if (state.pickTypes !== null) n++;
  if (state.releaseFrom || state.releaseTo) n++;
  if (state.released !== 'all') n++;
  if (state.profitability !== 'all') n++;
  if (state.showUnowned) n++;
  return n;
}

function matchSearch(movie, q) {
  if (!q) return true;
  var t = movie.movie_title || '';
  return t.toLowerCase().indexOf(q.toLowerCase()) !== -1;
}

function matchOwner(movie, set) {
  if (!set) return true;
  return set.has(movie.owner);
}

function matchPickType(movie, set) {
  if (!set) return true;
  return set.has((movie.pick_type || '').toLowerCase());
}

function matchReleaseRange(movie, from, to) {
  if (!from && !to) return true;
  var d = movie.release_date;
  if (!d || d === 'TBA') return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchReleasedStatus(movie, status, latestDate) {
  if (status === 'all') return true;
  var d = movie.release_date;
  if (!d || d === 'TBA') return status === 'upcoming';
  if (status === 'released') return latestDate ? d <= latestDate : false;
  if (status === 'upcoming') return latestDate ? d > latestDate : false;
  return true;
}

function matchProfitability(movie, mode) {
  if (mode === 'all') return true;
  if (movie.profit_td == null) return false;
  if (mode === 'profitable') return movie.profit_td > 0;
  if (mode === 'red') return movie.profit_td < 0;
  return true;
}

function matchUnowned(movie, showUnowned, hasOwnerFilter) {
  if (hasOwnerFilter) return true; // owner filter already includes/excludes
  if (movie.owner === 'none' && !showUnowned) return false;
  return true;
}

export function createFilterState(opts) {
  var state = clone(DEFAULT);
  var onChange = opts && opts.onChange ? opts.onChange : function() {};

  function notify() { onChange(snapshot()); }

  function snapshot() {
    return {
      search:        state.search,
      owners:        state.owners ? Array.from(state.owners) : null,
      pickTypes:     state.pickTypes ? Array.from(state.pickTypes) : null,
      releaseFrom:   state.releaseFrom,
      releaseTo:     state.releaseTo,
      released:      state.released,
      profitability: state.profitability,
      showUnowned:   state.showUnowned,
      activeCount:   activeDimensionCount(state),
      isDefault:     isDefault(state),
    };
  }

  return {
    snapshot: snapshot,

    setSearch: function(q) { state.search = q || ''; notify(); },

    toggleOwner: function(name) {
      if (state.owners === null) state.owners = new Set();
      if (state.owners.has(name)) state.owners.delete(name);
      else state.owners.add(name);
      if (state.owners.size === 0) state.owners = null;
      notify();
    },
    clearOwners: function() { state.owners = null; notify(); },
    setOwners: function(arr) {
      if (!arr || arr.length === 0) state.owners = null;
      else state.owners = new Set(arr);
      notify();
    },

    togglePickType: function(t) {
      var key = (t || '').toLowerCase();
      if (state.pickTypes === null) state.pickTypes = new Set();
      if (state.pickTypes.has(key)) state.pickTypes.delete(key);
      else state.pickTypes.add(key);
      if (state.pickTypes.size === 0) state.pickTypes = null;
      notify();
    },
    clearPickTypes: function() { state.pickTypes = null; notify(); },

    setReleaseRange: function(from, to) {
      state.releaseFrom = from || '';
      state.releaseTo = to || '';
      notify();
    },
    clearReleaseRange: function() { state.releaseFrom = ''; state.releaseTo = ''; notify(); },

    setReleasedStatus: function(s) {
      if (s !== 'all' && s !== 'released' && s !== 'upcoming') return;
      state.released = s;
      notify();
    },

    setProfitability: function(s) {
      if (s !== 'all' && s !== 'profitable' && s !== 'red') return;
      state.profitability = s;
      notify();
    },

    setShowUnowned: function(v) { state.showUnowned = !!v; notify(); },

    clearAll: function() {
      state = clone(DEFAULT);
      notify();
    },

    clearDimension: function(name) {
      switch (name) {
        case 'search':        state.search = ''; break;
        case 'owners':        state.owners = null; break;
        case 'pickTypes':     state.pickTypes = null; break;
        case 'releaseRange':  state.releaseFrom = ''; state.releaseTo = ''; break;
        case 'released':      state.released = 'all'; break;
        case 'profitability': state.profitability = 'all'; break;
        case 'unowned':       state.showUnowned = false; break;
      }
      notify();
    },

    filter: function(moviesObj, latestDate) {
      var ids = Object.keys(moviesObj || {});
      var hasOwnerFilter = state.owners !== null;
      return ids.filter(function(id) {
        var m = moviesObj[id];
        if (!m) return false;
        if (!matchSearch(m, state.search)) return false;
        if (!matchOwner(m, state.owners)) return false;
        if (!matchPickType(m, state.pickTypes)) return false;
        if (!matchReleaseRange(m, state.releaseFrom, state.releaseTo)) return false;
        if (!matchReleasedStatus(m, state.released, latestDate)) return false;
        if (!matchProfitability(m, state.profitability)) return false;
        if (!matchUnowned(m, state.showUnowned, hasOwnerFilter)) return false;
        return true;
      });
    },
  };
}
