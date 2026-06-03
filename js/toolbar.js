// ── Filters toolbar ────────────────────────────────────────────────────────
// Renders the Filters button + active chips and a collapsible panel of filter
// sections. All state changes are pushed back through the filters module; this
// module never holds filter state of its own.

export function createToolbar(opts) {
  var filters = opts.filters;
  var owners = opts.owners;
  var colorMap = opts.colorMap;
  var panel = document.getElementById('filters-panel');
  var toggleBtn = document.getElementById('filters-toggle');
  var badge = document.getElementById('filters-badge');
  var chipsEl = document.getElementById('filter-chips');
  var panelOpen = false;
  var panelBound = false;

  function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function searchSection() {
    var snap = filters.snapshot();
    return ''
      + '<div class="filter-row">'
      +   '<span class="filter-label">Search</span>'
      +   '<input type="text" id="filter-search" class="form-control form-control-sm" style="max-width:280px" placeholder="Title contains…" value="' + escapeAttr(snap.search) + '">'
      + '</div>';
  }

  function ownerSection() {
    var snap = filters.snapshot();
    var active = snap.owners ? new Set(snap.owners) : null;
    var html = owners.map(function(o) {
      var on = (active === null) ? false : active.has(o);
      var c = colorMap[o] || '#888';
      return '<button class="filter-chip-toggle' + (on ? ' on' : '') + '" data-owner="' + o + '" type="button">'
           + '<span class="owner-dot" style="background:' + c + '"></span>' + o + '</button>';
    }).join('');
    return '<div class="filter-row"><span class="filter-label">Owner</span><div class="filter-chips-toggle">' + html + '</div></div>';
  }

  function pickTypeSection() {
    var snap = filters.snapshot();
    var active = snap.pickTypes ? new Set(snap.pickTypes) : null;
    var types = [
      { key: 'hit',      label: 'Hit' },
      { key: 'seasonal', label: 'Seasonal' },
      { key: 'bomb',     label: 'Bomb' },
    ];
    var html = types.map(function(t) {
      var on = active && active.has(t.key);
      return '<button class="filter-chip-toggle' + (on ? ' on' : '') + '" data-pick-type="' + t.key + '" type="button">' + t.label + '</button>';
    }).join('');
    return '<div class="filter-row"><span class="filter-label">Pick type</span><div class="filter-chips-toggle">' + html + '</div></div>';
  }

  function dateSection() {
    var snap = filters.snapshot();
    return ''
      + '<div class="filter-row">'
      +   '<span class="filter-label">Release date</span>'
      +   '<input type="date" id="filter-date-from" class="form-control form-control-sm" style="width:auto" value="' + (snap.releaseFrom || '') + '">'
      +   '<span class="text-muted" style="font-size:0.78rem">to</span>'
      +   '<input type="date" id="filter-date-to" class="form-control form-control-sm" style="width:auto" value="' + (snap.releaseTo || '') + '">'
      + '</div>';
  }

  function releasedSection() {
    var snap = filters.snapshot();
    var options = [
      { key: 'all',      label: 'All' },
      { key: 'released', label: 'Released only' },
      { key: 'upcoming', label: 'Upcoming only' },
    ];
    var html = options.map(function(o) {
      return '<button class="filter-segmented-btn' + (snap.released === o.key ? ' on' : '') + '" data-released-status="' + o.key + '" type="button">' + o.label + '</button>';
    }).join('');
    return '<div class="filter-row"><span class="filter-label">Released</span><div class="filter-segmented">' + html + '</div></div>';
  }

  function profitabilitySection() {
    var snap = filters.snapshot();
    var options = [
      { key: 'all',        label: 'All' },
      { key: 'profitable', label: 'Profitable' },
      { key: 'red',        label: 'In the red' },
    ];
    var html = options.map(function(o) {
      return '<button class="filter-segmented-btn' + (snap.profitability === o.key ? ' on' : '') + '" data-profitability="' + o.key + '" type="button">' + o.label + '</button>';
    }).join('');
    return '<div class="filter-row"><span class="filter-label">Profitability</span><div class="filter-segmented">' + html + '</div></div>';
  }

  function otherSection() {
    var snap = filters.snapshot();
    return ''
      + '<div class="filter-row">'
      +   '<span class="filter-label">Other</span>'
      +   '<label class="form-check-label" style="font-size:0.85rem"><input type="checkbox" id="filter-unowned" class="form-check-input me-1" ' + (snap.showUnowned ? 'checked' : '') + '>Show unowned movies</label>'
      +   '<button id="filter-clear-all" class="btn btn-link btn-sm ms-auto" type="button" style="font-size:0.8rem">Clear all filters</button>'
      + '</div>';
  }

  function renderPanel() {
    panel.innerHTML = searchSection()
      + ownerSection()
      + pickTypeSection()
      + dateSection()
      + releasedSection()
      + profitabilitySection()
      + otherSection();
    bindPanel();
  }

  // Reflect state changes onto the already-rendered panel without rebuilding it,
  // so an input the user is typing in (search, date) keeps focus and caret.
  function syncPanel() {
    var snap = filters.snapshot();
    var owners = snap.owners ? new Set(snap.owners) : null;
    var pickTypes = snap.pickTypes ? new Set(snap.pickTypes) : null;
    Array.prototype.forEach.call(panel.querySelectorAll('[data-owner]'), function(b) {
      b.classList.toggle('on', !!owners && owners.has(b.dataset.owner));
    });
    Array.prototype.forEach.call(panel.querySelectorAll('[data-pick-type]'), function(b) {
      b.classList.toggle('on', !!pickTypes && pickTypes.has(b.dataset.pickType));
    });
    Array.prototype.forEach.call(panel.querySelectorAll('[data-released-status]'), function(b) {
      b.classList.toggle('on', snap.released === b.dataset.releasedStatus);
    });
    Array.prototype.forEach.call(panel.querySelectorAll('[data-profitability]'), function(b) {
      b.classList.toggle('on', snap.profitability === b.dataset.profitability);
    });
    var fromEl = panel.querySelector('#filter-date-from');
    var toEl = panel.querySelector('#filter-date-to');
    if (fromEl && document.activeElement !== fromEl) fromEl.value = snap.releaseFrom || '';
    if (toEl && document.activeElement !== toEl) toEl.value = snap.releaseTo || '';
    var unEl = panel.querySelector('#filter-unowned');
    if (unEl) unEl.checked = snap.showUnowned;
    var searchEl = panel.querySelector('#filter-search');
    if (searchEl && document.activeElement !== searchEl) searchEl.value = snap.search;
  }

  function bindPanel() {
    if (panelBound) return;
    panelBound = true;

    panel.addEventListener('click', function(e) {
      var ownerBtn = e.target.closest('[data-owner]');
      if (ownerBtn) { filters.toggleOwner(ownerBtn.dataset.owner); return; }
      var typeBtn = e.target.closest('[data-pick-type]');
      if (typeBtn) { filters.togglePickType(typeBtn.dataset.pickType); return; }
      var relBtn = e.target.closest('[data-released-status]');
      if (relBtn) { filters.setReleasedStatus(relBtn.dataset.releasedStatus); return; }
      var profBtn = e.target.closest('[data-profitability]');
      if (profBtn) { filters.setProfitability(profBtn.dataset.profitability); return; }
      if (e.target.id === 'filter-clear-all') { filters.clearAll(); return; }
    });

    panel.addEventListener('change', function(e) {
      if (e.target.id === 'filter-date-from' || e.target.id === 'filter-date-to') {
        var fromEl = panel.querySelector('#filter-date-from');
        var toEl = panel.querySelector('#filter-date-to');
        filters.setReleaseRange(fromEl ? fromEl.value : '', toEl ? toEl.value : '');
        return;
      }
      if (e.target.id === 'filter-unowned') {
        filters.setShowUnowned(e.target.checked);
        return;
      }
    });

    var debounceTimer = null;
    panel.addEventListener('input', function(e) {
      if (e.target.id !== 'filter-search') return;
      var val = e.target.value;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() { filters.setSearch(val); }, 150);
    });
  }

  function chipsForSnapshot(snap) {
    var chips = [];
    if (snap.search) {
      chips.push({ key: 'search', label: 'Search: "' + snap.search + '"' });
    }
    if (snap.owners && snap.owners.length > 0) {
      var label = (snap.owners.length <= 2)
        ? 'Owners: ' + snap.owners.join(', ')
        : 'Owners: ' + snap.owners.length;
      chips.push({ key: 'owners', label: label });
    }
    if (snap.pickTypes && snap.pickTypes.length > 0) {
      chips.push({ key: 'pickTypes', label: 'Type: ' + snap.pickTypes.map(cap).join(', ') });
    }
    if (snap.releaseFrom || snap.releaseTo) {
      var l = 'Released: ' + (snap.releaseFrom || '…') + ' to ' + (snap.releaseTo || '…');
      chips.push({ key: 'releaseRange', label: l });
    }
    if (snap.released !== 'all') {
      chips.push({ key: 'released', label: snap.released === 'released' ? 'Released only' : 'Upcoming only' });
    }
    if (snap.profitability !== 'all') {
      chips.push({ key: 'profitability', label: snap.profitability === 'profitable' ? 'Profitable' : 'In the red' });
    }
    if (snap.showUnowned) {
      chips.push({ key: 'unowned', label: 'Unowned included' });
    }
    return chips;
  }

  function renderChips() {
    var snap = filters.snapshot();
    var chips = chipsForSnapshot(snap);
    chipsEl.innerHTML = chips.map(function(c) {
      return '<span class="filter-chip" data-dim="' + c.key + '">' + c.label
           + ' <button class="filter-chip-close" type="button" aria-label="Clear ' + c.key + '">×</button></span>';
    }).join('');
    if (snap.activeCount > 0) {
      badge.textContent = String(snap.activeCount);
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  }

  chipsEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.filter-chip-close');
    if (!btn) return;
    var chip = btn.closest('.filter-chip');
    if (!chip) return;
    filters.clearDimension(chip.dataset.dim);
  });

  toggleBtn.addEventListener('click', function() {
    panelOpen = !panelOpen;
    panel.classList.toggle('d-none', !panelOpen);
    toggleBtn.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
    if (panelOpen) renderPanel();
  });

  return {
    refresh: function() {
      renderChips();
      if (panelOpen) syncPanel();
    },
  };
}
