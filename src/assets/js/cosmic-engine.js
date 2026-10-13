/* Site engine — the two ambient systems the game still uses.

   Externalized from index.html so CSP script-src `self` covers it permanently
   (inline hash-pinning broke in prod whenever the engine changed). Loaded with
   defer; SSR-safe and reduced-motion aware.

   It used to run fifteen systems for the old tools site — a constellation
   canvas, a cursor-following pulsar, a custom cursor halo, scroll-reveal,
   magnetic buttons, card tilt, click sparks, count-ups, type-on headings,
   scroll parallax, form confetti and a route veil. None of them had a kept
   page that needed them, so they went with the tools site (2026-10-13).
   What is left: */

    (function () {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;

      var prefersReduced = false;
      try { prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

      // rAF-throttled debouncer — coalesces bursty mutations into 1 run per frame
      function rafThrottle(fn) {
        var queued = false;
        return function () {
          if (queued) return;
          queued = true;
          requestAnimationFrame(function () { queued = false; fn(); });
        };
      }

      // ─────────────────────────────────────────────────────────────
      // 1. CURSOR TRAIL — particles spawn at the cursor and drift away.
      //    The Market's Cursor Trail cosmetic recolours it (html[data-cos-trail]).
      // ─────────────────────────────────────────────────────────────
      if (!prefersReduced && !('ontouchstart' in window)) {
        var trailContainer = document.createElement('div');
        trailContainer.className = 'cosmic-trail-layer';
        document.body.appendChild(trailContainer);

        var lastTrailX = 0, lastTrailY = 0;
        var trailParticles = [];
        var maxTrail = 14;
        var trailMinDist = 18; // only spawn if cursor moved 18+ px
        var trailColors = ['#4dffe0', '#a48bff', '#ff6dd7', '#5fb6ff', '#ffc669'];

        window.addEventListener('mousemove', function (e) {
          var dx = e.clientX - lastTrailX;
          var dy = e.clientY - lastTrailY;
          if (dx * dx + dy * dy < trailMinDist * trailMinDist) return;
          lastTrailX = e.clientX; lastTrailY = e.clientY;

          if (trailParticles.length >= maxTrail) {
            var oldest = trailParticles.shift();
            if (oldest && oldest.parentNode) oldest.parentNode.removeChild(oldest);
          }
          var p = document.createElement('span');
          p.className = 'cosmic-trail-particle';
          p.style.left = e.clientX + 'px';
          p.style.top = e.clientY + 'px';
          p.style.setProperty('--trail-color', trailColors[Math.floor(Math.random() * trailColors.length)]);
          p.style.setProperty('--trail-dx', ((Math.random() - 0.5) * 30).toFixed(1) + 'px');
          p.style.setProperty('--trail-dy', ((Math.random() - 0.5) * 30 - 6).toFixed(1) + 'px');
          trailContainer.appendChild(p);
          trailParticles.push(p);
          setTimeout(function () {
            if (p.parentNode) p.parentNode.removeChild(p);
            var idx = trailParticles.indexOf(p);
            if (idx > -1) trailParticles.splice(idx, 1);
          }, 1200);
        }, { passive: true });
      }

      // ─────────────────────────────────────────────────────────────
      // 2. AMBIENT DRONE — Web Audio API, barely audible, ritual-mode triggered.
      //    The Codex secret 'The Drone' promises it.
      // ─────────────────────────────────────────────────────────────
      // No external assets — synthesized in browser. Gated by ritual mode (arcane
      // seal, konami code, xsantcastx.reveal). Browser autoplay policies require
      // a user gesture to create AudioContext, which is naturally satisfied here.
      if (!prefersReduced) {
        var cosmicAudio = null;
        function ensureCosmicAudio() {
          if (cosmicAudio) return cosmicAudio;
          var AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          try {
            var actx = new AudioCtx();

            // Master + lowpass for warmth
            var master = actx.createGain();
            master.gain.value = 0; // silent until faded in
            var filter = actx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 720;
            filter.Q.value = 0.6;
            filter.connect(master);
            master.connect(actx.destination);

            // Bass drone — low A1 (55 Hz) sine
            var bass = actx.createOscillator();
            bass.type = 'sine';
            bass.frequency.value = 55;
            var bassGain = actx.createGain();
            bassGain.gain.value = 0.45;
            bass.connect(bassGain).connect(filter);

            // Octave pad — A2 triangle for body
            var oct = actx.createOscillator();
            oct.type = 'triangle';
            oct.frequency.value = 110;
            var octGain = actx.createGain();
            octGain.gain.value = 0.18;
            oct.connect(octGain).connect(filter);

            // Mid harmony — A3 + slightly detuned twin (chorus effect)
            var mid1 = actx.createOscillator();
            mid1.type = 'sine';
            mid1.frequency.value = 220;
            var mid1Gain = actx.createGain();
            mid1Gain.gain.value = 0.1;
            mid1.connect(mid1Gain).connect(filter);

            var mid2 = actx.createOscillator();
            mid2.type = 'sine';
            mid2.frequency.value = 220;
            mid2.detune.value = 7; // 7 cents off — slow chorus beat
            var mid2Gain = actx.createGain();
            mid2Gain.gain.value = 0.08;
            mid2.connect(mid2Gain).connect(filter);

            // Fifth above — adds cosmic openness (E4 ≈ 329.6)
            var fifth = actx.createOscillator();
            fifth.type = 'sine';
            fifth.frequency.value = 329.6;
            var fifthGain = actx.createGain();
            fifthGain.gain.value = 0.05;
            fifth.connect(fifthGain).connect(filter);

            // Slow LFO breathing the bass volume — 0.08 Hz = 12.5s cycle
            var lfo = actx.createOscillator();
            lfo.frequency.value = 0.08;
            var lfoDepth = actx.createGain();
            lfoDepth.gain.value = 0.12;
            lfo.connect(lfoDepth).connect(bassGain.gain);

            // Slow filter sweep — 0.04 Hz = 25s cycle, ±300Hz around 720Hz
            var filterLfo = actx.createOscillator();
            filterLfo.frequency.value = 0.04;
            var filterDepth = actx.createGain();
            filterDepth.gain.value = 220;
            filterLfo.connect(filterDepth).connect(filter.frequency);

            bass.start(); oct.start(); mid1.start(); mid2.start();
            fifth.start(); lfo.start(); filterLfo.start();

            cosmicAudio = {
              ctx: actx,
              master: master,
              fadeIn: function (target, dur) {
                target = target == null ? 0.05 : target;
                dur = dur || 2.5;
                if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
                master.gain.cancelScheduledValues(actx.currentTime);
                master.gain.setValueAtTime(master.gain.value, actx.currentTime);
                master.gain.linearRampToValueAtTime(target, actx.currentTime + dur);
              },
              fadeOut: function (dur) {
                dur = dur || 1.5;
                master.gain.cancelScheduledValues(actx.currentTime);
                master.gain.setValueAtTime(master.gain.value, actx.currentTime);
                master.gain.linearRampToValueAtTime(0, actx.currentTime + dur);
              }
            };
          } catch (e) { return null; }
          return cosmicAudio;
        }

        // Sync the drone with body.ritual-open
        function syncCosmicAudio() {
          var open = document.body.classList.contains('ritual-open');
          if (!open && !cosmicAudio) return; // no need to instantiate if user never engaged ritual
          var audio = ensureCosmicAudio();
          if (!audio) return;
          if (open) audio.fadeIn(0.05, 2.5);
          else audio.fadeOut(1.5);
        }

        var rmo = new MutationObserver(rafThrottle(syncCosmicAudio));
        rmo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        // Expose for the console reveal helper
        try {
          window.xsantcastx = window.xsantcastx || {};
          window.xsantcastx.toggleAudio = function () {
            var audio = ensureCosmicAudio();
            if (!audio) return 'no-audio-context';
            var on = audio.master.gain.value > 0.01;
            if (on) audio.fadeOut(1.2);
            else audio.fadeIn(0.05, 2);
            return on ? 'silenced' : 'singing';
          };
        } catch (e) {}
      }

    })();
