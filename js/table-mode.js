var COOKIE_MODE = 'mb_table_mode';
var VALID = { cards: 1, compact: 1, detailed: 1 };

function readCookie(name) {
  var m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name, value, days) {
  var exp = new Date();
  exp.setDate(exp.getDate() + (days || 365));
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + exp.toUTCString() + '; path=/; SameSite=Lax';
}

export function initialMode() {
  var saved = readCookie(COOKIE_MODE);
  if (saved && VALID[saved]) return saved;
  return (window.innerWidth >= 768) ? 'compact' : 'cards';
}

export function saveMode(mode) {
  if (!VALID[mode]) return;
  writeCookie(COOKIE_MODE, mode);
}

export function createModeSwitcher(opts) {
  var container = document.querySelector('[role="group"][aria-label="View mode"]');
  if (!container) return null;
  var current = opts.initial;

  function paintActive() {
    Array.prototype.forEach.call(container.querySelectorAll('button[data-mode]'), function(btn) {
      if (btn.dataset.mode === current) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  container.addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    var mode = btn.dataset.mode;
    if (!VALID[mode] || mode === current) return;
    current = mode;
    saveMode(mode);
    paintActive();
    opts.onChange(mode);
  });

  paintActive();
  return {
    getMode: function() { return current; },
    setMode: function(mode) {
      if (!VALID[mode] || mode === current) return;
      current = mode;
      paintActive();
      opts.onChange(mode);
    },
  };
}

var COOKIE_TOAST = 'mb_toast_narrow_seen';

export function showNarrowToast() {
  if (readCookie(COOKIE_TOAST)) return;
  var existing = document.getElementById('mb-toast');
  if (existing) existing.remove();
  var el = document.createElement('div');
  el.id = 'mb-toast';
  el.className = 'mb-toast';
  el.textContent = 'Switched to Cards. Screen is too narrow for the table.';
  document.body.appendChild(el);
  setTimeout(function() { el.classList.add('mb-toast--show'); }, 10);
  setTimeout(function() {
    el.classList.remove('mb-toast--show');
    setTimeout(function() { el.remove(); }, 300);
  }, 4500);
  writeCookie(COOKIE_TOAST, '1', 1); // 1 day
}
