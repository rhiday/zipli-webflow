(function () {
  var nav = document.querySelector('.navbar-logo-left');
  if (!nav) return;

  var threshold = 40;

  function update() {
    if (window.scrollY > threshold) {
      nav.classList.add('navbar-scrolled');
    } else {
      nav.classList.remove('navbar-scrolled');
    }
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
})();
