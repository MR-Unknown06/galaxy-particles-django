// Small UI helpers: "Log in" dropdown + replay button spin.
(function () {
  'use strict';

  var btn = document.getElementById('login-btn');
  var menu = document.getElementById('login-menu');
  if (btn && menu) {
    var setOpen = function (open) {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(menu.hidden);
    });
    document.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  var replay = document.getElementById('replay');
  if (replay) {
    replay.addEventListener('click', function () {
      replay.classList.add('is-spinning');
      setTimeout(function () { replay.classList.remove('is-spinning'); }, 750);
    });
  }
})();
