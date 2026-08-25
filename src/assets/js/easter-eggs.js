/* ░▒▓█ easter eggs █▓▒░
 *
 * This lives in an external file rather than inline in index.html on purpose.
 *
 * The production CSP pins inline <script> blocks by sha256 hash. A hash is a
 * checksum of the script body, so *any* edit to the block — even a comment —
 * invalidates it, and the browser then refuses to run the script. There is no
 * build error and no console warning that ties the failure back to the edit;
 * the feature simply stops existing in production while continuing to work in
 * `ng serve` (which sends no CSP at all). That drift already happened once:
 * the hash in firebase.json matched neither inline block in this file.
 *
 * Anything served from /assets is covered by `script-src 'self'`, which no edit
 * can invalidate. Only the boot-sequence script stays inline, because it has to
 * run before the first paint and cannot afford a round-trip — and
 * scripts/verify-csp-hashes.js now fails the build if its hash ever drifts.
 */
(function () {
  'use strict';

  // ── console banner ───────────────────────────────────────────────────────
  try {
    var banner = [
      '',
      '   ░▒▓█ x s a n t c a s t x █▓▒░',
      '',
      '        ✧ ⟡ ⚝ ✶ ☽ ✧ ☾ ✷ ⟢ ⚜',
      '',
      '   » You found the console. Welcome, seeker.',
      '   » Whisper the old sequence:',
      '        ↑ ↑ ↓ ↓ ← → ← → B A',
      '   » Or click the sigil in the corner.',
      '   » Type xsantcastx.reveal() for another secret.',
      ''
    ].join('\n');
    console.log('%c' + banner,
      'color:#8B5CF6;font-family:Menlo,monospace;line-height:1.4;text-shadow:0 0 8px rgba(139,92,246,0.4)');
  } catch (e) {}

  // ── Konami code → ritual mode ────────────────────────────────────────────
  var code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var idx = 0;
  window.addEventListener('keydown', function (e) {
    var k = (e.key || '').length === 1 ? e.key.toLowerCase() : e.key;
    idx = (k === code[idx]) ? idx + 1 : 0;
    if (idx === code.length) {
      idx = 0;
      document.body.classList.add('ritual-open');
      try { console.log('%c✦ The sigil answers. ✦', 'color:#ff00ff;font-size:18px;font-family:Orbitron;text-shadow:0 0 14px #ff00ff'); } catch (e2) {}
    }
  }, { passive: true });

  // ── arcane seal ──────────────────────────────────────────────────────────
  // Was an inline onclick="" attribute. Inline event handlers are *not* covered
  // by script-src hashes at all — a handler needs 'unsafe-hashes' alongside its
  // own hash, or blanket 'unsafe-inline'. Binding it here means the strict CSP
  // needs neither.
  var seal = document.querySelector('.arcane-seal');
  if (seal) {
    seal.addEventListener('click', function () {
      var b = document.body;
      b.classList.toggle('ritual-open');
      if (b.classList.contains('ritual-open')) {
        try {
          console.log('%c✦ The veil parts. ✦',
            'color:#8B5CF6;font-family:Orbitron;font-size:16px;text-shadow:0 0 12px #8B5CF6');
        } catch (e3) {}
      }
    });
  }


  // ── hidden helper ────────────────────────────────────────────────────────
  try {
    window.xsantcastx = window.xsantcastx || {};
    window.xsantcastx.reveal = function () {
      document.body.classList.toggle('ritual-open');
      var msgs = [
        'built in the dark, shipped in the light.',
        'every tool here is a small spell.',
        'the sigil was always watching.',
        'ctrl+shift+k opens the other door.'
      ];
      var m = msgs[Math.floor(Math.random() * msgs.length)];
      console.log('%c☾ ' + m + ' ☽', 'color:#7b61ff;font-family:Orbitron;font-size:14px;text-shadow:0 0 10px #7b61ff');
      return '✧';
    };
  } catch (e) {}
})();
