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

  var chipsShown = false;

  function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }

  // ── Fold animation (shared by the panel and the chips row) ──────────────
  // Neither can transition display:none, so they fold their height (plus
  // padding/margin/opacity) between 0 and the natural size. The element's
  // content must already be set before foldOpen measures the target.
  function clearFold(el) {
    el.style.height = '';
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    el.style.marginBottom = '';
    el.style.opacity = '';
  }
  function foldOpen(el) {
    el.classList.remove('fold-closing', 'fold-opening');
    clearFold(el);
    el.classList.remove('d-none');
    var target = el.getBoundingClientRect().height; // natural open size
    el.style.height = '0px';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el.style.marginBottom = '0px';
    el.style.opacity = '0';
    void el.offsetWidth; // lock the collapsed start before transitioning
    el.classList.add('fold-opening');
    el.style.height = target + 'px';
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    el.style.marginBottom = '';
    el.style.opacity = '';
  }
  function foldClose(el) {
    el.classList.remove('fold-opening');
    var h = el.getBoundingClientRect().height;
    el.style.height = h + 'px';
    void el.offsetWidth; // lock the starting height before transitioning
    el.classList.add('fold-closing');
    el.style.height = '0px';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el.style.marginBottom = '0px';
    el.style.opacity = '0';
  }
  function wireFold(el) {
    el.addEventListener('transitionend', function(e) {
      if (e.propertyName !== 'height') return;
      if (el.classList.contains('fold-closing')) {
        el.classList.add('d-none');
        el.classList.remove('fold-closing');
        clearFold(el);
      } else if (el.classList.contains('fold-opening')) {
        el.classList.remove('fold-opening');
        clearFold(el);
      }
    });
  }
  wireFold(panel);
  wireFold(chipsEl);

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

  function chipInner(c) {
    return escapeAttr(c.label)
      + ' <button class="filter-chip-close" type="button" aria-label="Clear ' + c.key + '">×</button>';
  }
  function createChip(c) {
    var el = document.createElement('span');
    el.className = 'filter-chip';
    el.setAttribute('data-dim', c.key);
    el.setAttribute('data-label', c.label);
    el.innerHTML = chipInner(c);
    return el;
  }
  // A chip widens in when added and collapses out when removed; the filter
  // itself has already been applied, so this is purely visual.
  function animateChipIn(el) {
    var target = el.getBoundingClientRect().width;
    el.style.overflow = 'hidden';
    el.style.width = '0px';
    el.style.opacity = '0';
    el.style.marginRight = '0px';
    el.style.paddingLeft = '0px';
    el.style.paddingRight = '0px';
    void el.offsetWidth;
    el.style.width = target + 'px';
    el.style.opacity = '';
    el.style.marginRight = '';
    el.style.paddingLeft = '';
    el.style.paddingRight = '';
    el.addEventListener('transitionend', function done(e) {
      if (e.propertyName !== 'width') return;
      el.removeEventListener('transitionend', done);
      el.style.width = '';
      el.style.overflow = '';
    });
  }
  function animateChipOut(el) {
    el.classList.add('chip-leaving');
    var w = el.getBoundingClientRect().width;
    el.style.overflow = 'hidden';
    el.style.width = w + 'px';
    void el.offsetWidth;
    el.style.width = '0px';
    el.style.opacity = '0';
    el.style.marginRight = '0px';
    el.style.paddingLeft = '0px';
    el.style.paddingRight = '0px';
    el.addEventListener('transitionend', function done(e) {
      if (e.propertyName !== 'width') return;
      el.removeEventListener('transitionend', done);
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  // Reconcile chips by data-dim (instead of re-rendering wholesale) so removed
  // chips can animate out and unchanged ones stay put.
  function reconcileChips(desired) {
    var present = {};
    Array.prototype.forEach.call(chipsEl.querySelectorAll('.filter-chip'), function(el) {
      if (!el.classList.contains('chip-leaving')) present[el.getAttribute('data-dim')] = el;
    });
    var wanted = {};
    var prev = null;
    desired.forEach(function(c) {
      wanted[c.key] = true;
      var el = present[c.key];
      if (el) {
        if (el.getAttribute('data-label') !== c.label) {
          el.setAttribute('data-label', c.label);
          el.innerHTML = chipInner(c);
        }
      } else {
        el = createChip(c);
        chipsEl.insertBefore(el, prev ? prev.nextSibling : chipsEl.firstChild);
        animateChipIn(el);
      }
      prev = el;
    });
    Array.prototype.forEach.call(chipsEl.querySelectorAll('.filter-chip'), function(el) {
      if (!wanted[el.getAttribute('data-dim')] && !el.classList.contains('chip-leaving')) {
        animateChipOut(el);
      }
    });
  }

  function renderChips() {
    var snap = filters.snapshot();
    var chips = chipsForSnapshot(snap);
    var nowShown = chips.length > 0;
    if (nowShown && !chipsShown) {
      // Row first appears: render all chips and fold the row down.
      chipsEl.innerHTML = chips.map(function(c) {
        return '<span class="filter-chip" data-dim="' + c.key + '" data-label="' + escapeAttr(c.label) + '">' + chipInner(c) + '</span>';
      }).join('');
      foldOpen(chipsEl);
    } else if (!nowShown && chipsShown) {
      // Last chip(s) cleared: fold the whole row up, then hide.
      foldClose(chipsEl);
    } else if (nowShown && chipsShown) {
      // Row stays: add/remove individual chips with their own animation.
      reconcileChips(chips);
    }
    chipsShown = nowShown;
    if (snap.activeCount > 0) badge.textContent = String(snap.activeCount);
    badge.classList.toggle('is-collapsed', snap.activeCount === 0);
  }

  chipsEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.filter-chip-close');
    if (!btn) return;
    var chip = btn.closest('.filter-chip');
    if (!chip) return;
    filters.clearDimension(chip.dataset.dim);
  });

  function openPanel() {
    renderPanel();      // content must exist before foldOpen measures the target
    foldOpen(panel);
  }

  function closePanel() {
    foldClose(panel);
  }

  toggleBtn.addEventListener('click', function() {
    panelOpen = !panelOpen;
    toggleBtn.classList.toggle('active', panelOpen);
    toggleBtn.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
    if (panelOpen) openPanel();
    else closePanel();
  });

  return {
    refresh: function() {
      renderChips();
      if (panelOpen) syncPanel();
    },
  };
}
