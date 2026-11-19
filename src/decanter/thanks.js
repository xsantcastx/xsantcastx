  // Opens Decanter so it can say thank you too (the browser may ask first).
  setTimeout(function () { location.href = 'decanter://thanks'; }, 900);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (var i = 0; i < 16; i++) {
      var h = document.createElement('div');
      h.className = 'float';
      h.textContent = '♥';
      h.style.left = (Math.random() * 100) + 'vw';
      h.style.fontSize = (14 + Math.random() * 22) + 'px';
      h.style.animationDuration = (5 + Math.random() * 4) + 's';
      h.style.animationDelay = (Math.random() * 2.5) + 's';
      document.body.appendChild(h);
    }
  }
