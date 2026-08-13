/**
 * forge-flame.component.ts — the ember in the bottom-right corner.
 *
 * Mounted once, in AppComponent, next to the quest drawer and for the same
 * reason: `position: fixed` inside a routed host is not fixed at all. Every
 * routed component carries a `routeFadeIn` transform with `fill: forwards`,
 * which makes it a containing block, and a flame mounted inside one would be
 * pinned to the bottom-right of the *page* rather than the viewport, and would
 * disappear when you scrolled.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE FLAME IS FOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Three jobs, in order of how often they matter:
 *   1. It says how much Gold you have without being asked.
 *   2. It is the click target, at 1 Gold plus whatever the hammers add.
 *   3. It grows. Six tiers, driven by how many upgrades are owned, because a
 *      forge earning 40 Gold a minute that looks exactly like one earning 1 is
 *      the flattest possible reward for the money.
 *
 * Reduced motion keeps all three. The flame holds a static glow, the sparks do
 * not fire and the floaters appear and fade without travelling — but the button
 * is the same button and every strike still pays.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EconomyService, EconomySnapshot } from './economy.service';
import { formatCompact, formatCurrency, formatRate } from './economy.model';
import { ForgeAudioService } from './forge-audio.service';
import { InlineFlameService } from './inline-flame.service';
import { IdleService } from '../idle/idle.service';
import { ComboEvent, ComboService, ComboSnapshot } from './combo.service';
import {
  COMBO_TIERS,
  ComboEffect,
  ComboTone,
  NAMELESS_LABEL,
  pitchFor,
} from './combo.model';

/** One "+5" rising off the flame. */
interface Floater {
  key: number;
  text: string;
  /** Random horizontal offset so a fast clicker does not get one stacked column. */
  dx: number;
  big: boolean;
}

/** One spark in a burst. Angle and distance are precomputed, CSS does the rest. */
interface Spark {
  key: number;
  x: number;
  y: number;
  delay: number;
}

/** A milestone banner. Century Strike and Millennium Forge share the shape. */
interface Banner {
  title: string;
  sub: string;
  grand: boolean;
}

/** One combo tier name, thrown up over the flame and gone in a second and a half. */
interface Shout {
  key: number;
  text: string;
  tone: ComboTone;
  grand: boolean;
}

@Component({
  selector: 'app-forge-flame',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The combo's screen-level effects.
         A sibling of the flame rather than a child, and that is load-bearing:
         .ff takes a transform when it shakes, and a transformed ancestor turns
         position: fixed into position: absolute — the overlay would be pinned to
         the bottom-right corner instead of covering the viewport. -->
    @if (comboLevel > 0 || burst) {
      <div class="fx"
           [attr.data-level]="comboLevel"
           [attr.data-burst]="burst"
           aria-hidden="true">
        <span class="fx__edge"></span>
        <span class="fx__vignette"></span>
        @if (burst) { <span class="fx__sheet"></span> }
      </div>
    }

    <!-- The site-wide confetti hook the arena games use. Adding the node is the
         whole API; the cosmic engine's observer does the rest. -->
    @if (shattered) { <span data-success-burst hidden></span> }

    <div
      class="ff"
      [class.ff--inline]="inline"
      [attr.data-tier]="snap.flameTier"
      [attr.data-hammer]="snap.hammerVisual"
      [attr.data-combo]="comboLevel"
      [class.ff--quake]="quaking"
      [class.ff--shake]="shaking"
      [class.ff--swell]="swelling"
      [class.ff--auto]="autoBeat"
      [class.ff--still]="reducedMotion">

      @for (s of shouts; track s.key) {
        <span class="ff__shout" [attr.data-tone]="s.tone" [class.ff__shout--grand]="s.grand" aria-hidden="true">
          {{ s.text }}
        </span>
      }

      <!-- Only from x2. A "x1" beside every single click is noise, not a combo.
           Tracked on the count itself so each strike replaces the element and
           the punch animation replays — a CSS animation on an element that
           never leaves the DOM cannot be restarted by setting the same class. -->
      @for (c of comboBadge; track c) {
        <span class="ff__combo" [attr.data-tone]="comboTone" aria-hidden="true">x{{ c }}</span>
      }

      @if (banner) {
        <div class="ff__banner" [class.ff__banner--grand]="banner.grand" role="status">
          <strong>{{ banner.title }}</strong>
          <span>{{ banner.sub }}</span>
        </div>
      }

      <!-- The readout. A tooltip on a hover-only surface would be unreachable on
           a phone, so this is a real panel: hover opens it on a pointer device,
           and the long-press-free path is the Market link inside it. -->
      <div class="ff__hud" [class.ff__hud--open]="hudOpen" aria-hidden="true">
        <span class="ff__hud-gold">{{ gold }} <img class="ff__hud-coin gf-icon currency-icon" src="assets/icons/currencies/gold.png" alt="" aria-hidden="true" width="13" height="13" decoding="async" draggable="false"></span>
        <span class="ff__hud-rate">+{{ rate }}/sec</span>
        @if (snap.autoPerSecond > 0) {
          <span class="ff__hud-auto">⚙ Auto: {{ autoRate }} {{ snap.autoPerSecond === 1 ? 'click' : 'clicks' }}/sec</span>
        }
        <span class="ff__hud-hint">Click to forge · hold for runes</span>
        @if (snap.essence > 0) {
          <span class="ff__hud-essence"><img class="gf-icon currency-icon currency-icon--essence" src="assets/icons/currencies/essence.png" alt="" aria-hidden="true" width="13" height="13" decoding="async" draggable="false"> {{ essence }} Essence</span>
        }
        <a class="ff__hud-forge" routerLink="/rune-forge">Strike the Rune Forge &rarr;</a>
        <a class="ff__hud-market" routerLink="/market">Open the Market &rarr;</a>
      </div>

      <!-- The Rune Forge is the ember's second destination, and on a phone it is
           the one the HUD cannot be relied on to offer: pointerenter fires on
           touch, but the panel is dismissed by the same tap that opens it. So
           the gesture is bound directly.

           contextmenu covers right-click on a pointer device and the
           press-and-hold that raises the same event on touch; the pointer pair
           below covers the long presses that do not. Both suppress the strike
           they would otherwise be, which is what the pressed flag is for in
           onStrike.

           What contextmenu does NOT cover is iOS, which answers a long press
           with the native callout sheet and never raises the event at all —
           that one is suppressed in CSS with -webkit-touch-callout, and the
           note on .ff__btn is the long version. touchstart is bound here rather
           than on the host so that preventDefaulting it cannot reach the HUD's
           two links; see onTouchStrike.

           No backticks in this comment: it lives inside the component's
           template literal, and one would end the string. -->
      <button
        type="button"
        class="ff__btn"
        [class.is-tapping]="tapping"
        (click)="onStrike()"
        (touchstart)="onTouchStrike($event)"
        (contextmenu)="openRuneForge($event)"
        (pointerdown)="onPressStart()"
        (pointerup)="onPressEnd()"
        (pointercancel)="onPressEnd()"
        (pointerenter)="hudOpen = true"
        (pointerleave)="onPressEnd(); hudOpen = false"
        (focus)="hudOpen = true"
        (blur)="hudOpen = false"
        [attr.aria-label]="label">
        <span class="ff__core" aria-hidden="true"></span>
        <span class="ff__ring" aria-hidden="true"></span>
        <span class="ff__ring ff__ring--outer" aria-hidden="true"></span>
        <img class="ff__glyph forge-flame" src="assets/icons/forge-flame-128.png"
             alt="" aria-hidden="true" width="34" height="34"
             decoding="async" draggable="false">

        @for (s of sparks; track s.key) {
          <span class="ff__spark"
                [style.--sx.px]="s.x"
                [style.--sy.px]="s.y"
                [style.animation-delay.ms]="s.delay"
                aria-hidden="true"></span>
        }
      </button>

      <!-- A live region so a screen reader hears the payout without the -->
      <!-- floaters, which are decoration and are hidden from it. -->
      <p class="ff__sr" aria-live="polite">{{ announcement }}</p>

      @for (f of floaters; track f.key) {
        <span class="ff__float" [class.ff__float--big]="f.big" [style.--dx.px]="f.dx" aria-hidden="true">
          {{ f.text }}
        </span>
      }
    </div>
  `,
  styles: [`
    /* Sits above the footer and below the header's 1000, so the mobile drawer
       and the quest panel both still cover it. */
    .ff {
      position: fixed;
      right: clamp(12px, 3vw, 26px);
      bottom: clamp(12px, 3vw, 26px);
      z-index: 940;
      display: grid;
      place-items: center;
      pointer-events: none;
    }

    /* Mounted in the page instead of pinned to the corner — see
       InlineFlameService for why both never render at once. Only the pinning
       is undone: every tier, combo and hammer rule below keys off .ff and its
       data attributes, so the inline flame is the same flame in a new box. */
    .ff--inline {
      position: relative;
      right: auto;
      bottom: auto;
      z-index: auto;
    }
    .ff > * { pointer-events: auto; }

    /* …except the decorations, which must never intercept a strike.
       The rule above turns pointer events back on for every direct child, and
       the floater is a *sibling* of the button that rises straight across it. At
       two strikes a second there are always one or two in the air, so a tap
       landing on a "+1" instead of the ember is not hypothetical — it is a lost
       strike on the one interaction this whole feature is built around, and on a
       phone, where the ember is 52px, it is the difference between holding a
       combo and wondering why it keeps stalling. All three are aria-hidden
       decoration and none of them wants a click.

       Written as child selectors to match the shape of the rule above rather
       than as bare classes: Angular scopes both sides of a combinator, so the
       rule above becomes a two-attribute selector that outranks a single scoped
       class and keeps winning. Same combinator, same weight plus the class. */
    .ff > .ff__float,
    .ff > .ff__shout,
    .ff > .ff__combo { pointer-events: none; }

    /* ── The button ─────────────────────────────────────────────────────── */
    .ff__btn {
      position: relative;
      display: grid; place-items: center;
      width: 64px; height: 64px;
      padding: 0;
      border: none; border-radius: 50%;
      background: transparent;
      cursor: pointer;
      /* Release is the spring — it overshoots 1 then settles, and it is the
         half of a tap the thumb actually feels. The press itself is re-timed
         to .09s below, because a slow squash reads as lag. */
      transition:
        transform .34s cubic-bezier(.22, 1.28, .44, 1),
        filter .2s cubic-bezier(0.4, 0, 0.2, 1);
      -webkit-tap-highlight-color: transparent;

      /* ── What makes this tappable on a phone ──────────────────────────────
         Four declarations, and every one of them is fixing a real thing a
         finger was doing to this button.

         -webkit-touch-callout is the one the bug report was about. The
         template binds (contextmenu) and preventDefaults it, which handles a
         right-click and handles Android's long-press — but iOS Safari does not
         raise contextmenu from touch at all. It raises the native callout
         sheet instead, and the only thing that suppresses that sheet is this
         property. With an <img> inside the button the sheet even had a menu to
         offer: Save Image, Copy, Share. That is the "popup instead of the
         click".

         user-select stops the same press selecting the button's text — there
         is none, but a selection started here still drags across whatever is
         behind it and leaves the page in a text-selection gesture.

         touch-action: manipulation is the other half of the report. Without it
         double-tap-to-zoom is live on this element, which means (a) the browser
         holds every click for ~300ms waiting to see if a second tap is coming,
         and (b) a fast clicker — the entire point of this button — zooms the
         page instead of forging. manipulation keeps panning and pinch and drops
         only the double-tap, which is exactly the trade we want. */
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      touch-action: manipulation;
    }

    /* The strike, as the finger sees it.
       On touch the press is handled on touchstart and preventDefaulted, and a
       preventDefaulted touchstart does not produce the :active state (or focus,
       or a compatibility mouse event) — so the squash below has to be driven by
       a class the component sets, or a tap would land with no feedback at all.
       Same shape as :active so the two paths look identical, a hair deeper
       because a thumb covers the button it is pressing and needs the edges to
       move to see anything.

       On .ff__btn rather than on .ff: .ff carries the translateX(-50%) that
       centres the flame on a phone, and a transform here would overwrite it and
       throw the button half its own width off-centre mid-tap. */
    .ff__btn.is-tapping { transform: scale(.92); transition-duration: .09s; }

    /* The glyph is an image, and an image is a long-press target in its own
       right — the callout suppression above has to reach it too, and the
       cleanest way is to make it invisible to the pointer entirely so every
       touch resolves to the button. Same for the two HUD currency icons. */
    .ff img {
      pointer-events: none;
      -webkit-touch-callout: none;
      -webkit-user-drag: none;
      user-select: none;
    }

    /* .96, not the .9 this used to hold: the flame is a 64px target under a
       thumb, and a deeper squash reads as the button shrinking away from the
       finger rather than taking the press. */
    .ff__btn:active { transform: scale(.96); transition-duration: .09s; }

    /* Glow intensifies while held, on touch as well as pointer — :active is the
       one state a finger can reach, since there is no hover on a phone.
       The filter goes on the BUTTON, not on .ff__core: the core runs ffBreathe,
       which animates the filter property, and a running animation outranks a
       plain declaration for the property it animates. A filter rule on .ff__core
       would have been dead CSS with nothing to warn about it. */
    .ff__btn:active,
    .ff__btn:hover {
      filter: brightness(1.18) drop-shadow(0 0 16px rgba(232, 117, 42, .75));
    }

    .ff__btn:focus-visible { outline: 2px solid #A78BFA; outline-offset: 6px; border-radius: 50%; }

    @media (prefers-reduced-motion: reduce) {
      /* The brightness cue stays; the movement goes. Both press states, since
         on touch it is .is-tapping and not :active that carries the squash. */
      .ff__btn { transition: filter .01s linear; }
      .ff__btn:active, .ff__btn.is-tapping { transform: none; }
    }

    /* The ember itself. Warm gradient per the forge palette: #E8752A → #C9A84C. */
    .ff__core {
      position: absolute; inset: 8px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 36% 30%, #fff3d6 0%, #C9A84C 22%, #E8752A 58%, #6d2a12 92%);
      box-shadow:
        0 0 18px rgba(232, 117, 42, .55),
        0 0 44px -8px rgba(201, 168, 76, .55),
        inset 0 -4px 10px rgba(0, 0, 0, .45);
      animation: ffBreathe 3.6s ease-in-out infinite;
    }
    @keyframes ffBreathe {
      0%, 100% { transform: scale(1);    filter: brightness(1); }
      50%      { transform: scale(1.06); filter: brightness(1.18); }
    }

    .ff__glyph { position: relative; width: 34px; height: 34px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }

    /* Orbital rings. Tier decides how many are visible — see the tier block. */
    .ff__ring {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 1px dashed rgba(232, 117, 42, .45);
      opacity: 0;
      animation: ffSpin 18s linear infinite;
    }
    .ff__ring--outer {
      inset: -8px;
      border-style: solid;
      border-color: rgba(201, 168, 76, .28);
      animation: ffSpin 30s linear infinite reverse;
    }
    @keyframes ffSpin { to { transform: rotate(360deg); } }

    /* ── Growth. Each tier is one more thing the forge is doing. ─────────── */
    .ff[data-tier="1"] .ff__btn { width: 68px; height: 68px; }
    .ff[data-tier="1"] .ff__ring { opacity: .5; }

    .ff[data-tier="2"] .ff__btn { width: 72px; height: 72px; }
    .ff[data-tier="2"] .ff__ring, .ff[data-tier="2"] .ff__ring--outer { opacity: .55; }
    .ff[data-tier="2"] .ff__glyph { width: 38px; height: 38px; }

    .ff[data-tier="3"] .ff__btn { width: 78px; height: 78px; }
    .ff[data-tier="3"] .ff__ring, .ff[data-tier="3"] .ff__ring--outer { opacity: .7; }
    .ff[data-tier="3"] .ff__glyph { width: 42px; height: 42px; }
    .ff[data-tier="3"] .ff__core { box-shadow: 0 0 26px rgba(232,117,42,.7), 0 0 64px -8px rgba(201,168,76,.7), inset 0 -4px 10px rgba(0,0,0,.45); }

    .ff[data-tier="4"] .ff__btn { width: 84px; height: 84px; }
    .ff[data-tier="4"] .ff__ring, .ff[data-tier="4"] .ff__ring--outer { opacity: .85; }
    .ff[data-tier="4"] .ff__glyph { width: 46px; height: 46px; }
    .ff[data-tier="4"] .ff__core {
      background: radial-gradient(circle at 36% 30%, #fffaf0 0%, #ffd97a 20%, #E8752A 55%, #7b1f4a 94%);
      box-shadow: 0 0 32px rgba(232,117,42,.8), 0 0 80px -10px rgba(255,109,215,.5), inset 0 -4px 12px rgba(0,0,0,.5);
    }

    .ff[data-tier="5"] .ff__btn { width: 90px; height: 90px; }
    .ff[data-tier="5"] .ff__ring, .ff[data-tier="5"] .ff__ring--outer { opacity: 1; border-color: rgba(255, 214, 122, .8); }
    .ff[data-tier="5"] .ff__glyph { width: 50px; height: 50px; }
    .ff[data-tier="5"] .ff__core {
      background: radial-gradient(circle at 36% 30%, #ffffff 0%, #ffe9a8 16%, #E8752A 50%, #7b61ff 96%);
      box-shadow: 0 0 40px rgba(255,214,122,.9), 0 0 110px -12px rgba(123,97,255,.6), inset 0 -5px 14px rgba(0,0,0,.5);
      animation: ffBreathe 2.4s ease-in-out infinite;
    }

    /* Hammer visuals, layered over whatever tier the forge is at. */
    .ff[data-hammer="shadow"] .ff__btn::after,
    .ff[data-hammer="quake"] .ff__btn::after {
      content: ''; position: absolute; inset: -6px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(123, 97, 255, .35), transparent 70%);
      filter: blur(8px);
      animation: ffShadow 5s ease-in-out infinite;
    }
    @keyframes ffShadow { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: .8; transform: scale(1.15); } }

    /* ── Sparks ─────────────────────────────────────────────────────────── */
    .ff__spark {
      position: absolute; left: 50%; top: 50%;
      width: 4px; height: 4px; margin: -2px 0 0 -2px;
      border-radius: 50%;
      background: #ffd97a;
      box-shadow: 0 0 6px rgba(255, 217, 122, .9);
      animation: ffSpark .62s cubic-bezier(.2, .7, .3, 1) forwards;
    }
    @keyframes ffSpark {
      from { transform: translate(0, 0) scale(1); opacity: 1; }
      to   { transform: translate(var(--sx), var(--sy)) scale(.2); opacity: 0; }
    }

    /* ── Floaters ───────────────────────────────────────────────────────── */
    .ff__float {
      position: absolute; left: 50%; top: 6px;
      font: 700 14px/1 'Orbitron', system-ui, sans-serif;
      color: #ffd97a;
      text-shadow: 0 0 10px rgba(232, 117, 42, .8);
      white-space: nowrap;
      pointer-events: none;
      animation: ffFloat 1.1s cubic-bezier(.2, .8, .3, 1) forwards;
    }
    .ff__float--big { font-size: 18px; color: #fff3d6; }
    @keyframes ffFloat {
      from { transform: translate(calc(-50% + var(--dx)), 0) scale(.85); opacity: 0; }
      25%  { opacity: 1; }
      to   { transform: translate(calc(-50% + var(--dx)), -54px) scale(1.1); opacity: 0; }
    }

    /* ── Milestone banner ───────────────────────────────────────────────── */
    .ff__banner {
      position: absolute; bottom: calc(100% + 14px); right: 0;
      display: grid; gap: 2px;
      padding: 10px 14px;
      min-width: 178px;
      border-radius: 12px;
      border: 1px solid rgba(232, 117, 42, .55);
      background:
        radial-gradient(ellipse 80% 70% at 20% 0%, rgba(232, 117, 42, .16), transparent 65%),
        rgba(10, 6, 22, .95);
      box-shadow: 0 18px 44px -18px rgba(0, 0, 0, .9);
      animation: ffBanner .3s cubic-bezier(.22, 1, .36, 1);
    }
    .ff__banner strong { font: 700 13px/1.2 'Orbitron', system-ui, sans-serif; color: #ffd97a; }
    .ff__banner span   { font-size: 11px; color: #b9cdc7; }
    .ff__banner--grand { border-color: rgba(255, 45, 77, .7); }
    .ff__banner--grand strong { color: #ff8fa3; }
    @keyframes ffBanner { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    /* ── HUD ────────────────────────────────────────────────────────────── */
    .ff__hud {
      position: absolute; bottom: calc(100% + 10px); right: 0;
      display: grid; gap: 3px;
      padding: 10px 12px;
      min-width: 172px;
      border-radius: 12px;
      border: 1px solid rgba(201, 168, 76, .32);
      background: rgba(8, 5, 18, .95);
      box-shadow: 0 16px 40px -18px rgba(0, 0, 0, .9);
      opacity: 0; visibility: hidden;
      transform: translateY(6px);
      transition: opacity .2s ease, transform .2s ease, visibility .2s;
    }
    .ff__hud--open { opacity: 1; visibility: visible; transform: none; }
    .ff__hud-gold { font: 700 15px/1 'Orbitron', system-ui, sans-serif; color: #ffd97a; }
    .ff__hud-coin { width: 13px; height: 13px; vertical-align: -2px; }
    .ff__hud-rate { font-size: 11px; color: #A78BFA; }
    .ff__hud-auto { font-size: 11px; color: #7fd5a3; }
    .ff__hud-essence { font-size: 11px; color: #c48bff; }
    .ff__hud-hint { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #7d918c; }
    /* The Rune Forge takes the rule above it and the Market follows, so the two
       destinations read as one group rather than as a link and an afterthought.
       Gold on the forge, violet on the Market — the colours each page opens
       with. */
    .ff__hud-forge {
      margin-top: 4px; padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, .08);
      font-size: 11px; color: #C9A84C; text-decoration: none;
    }
    .ff__hud-market {
      margin-top: 2px;
      font-size: 11px; color: #A78BFA; text-decoration: none;
    }
    .ff__hud-forge:hover,
    .ff__hud-market:hover { text-decoration: underline; }

    /* A banner and the HUD would otherwise occupy the same 10px above the
       button. The banner is the louder message, so it takes the slot. */
    .ff__banner ~ .ff__hud { display: none; }

    .ff__sr {
      position: absolute; width: 1px; height: 1px; margin: -1px;
      padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }

    /* ── Combo: the counter ─────────────────────────────────────────────────
       Sits to the left of the ember rather than over it, so it never covers the
       thing being clicked and never moves the target as the digits grow. */
    .ff__combo {
      position: absolute; right: calc(100% + 10px); top: 50%;
      transform: translateY(-50%);
      font: 800 15px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .02em;
      white-space: nowrap;
      color: #A78BFA;
      text-shadow: 0 0 10px rgba(139, 92, 246, .8), 0 1px 3px rgba(0, 0, 0, .8);
      animation: ffComboBeat .22s cubic-bezier(.22, 1, .36, 1);
    }
    .ff__combo[data-tone="gold"] {
      color: #ffd97a;
      text-shadow: 0 0 12px rgba(201, 168, 76, .9), 0 1px 3px rgba(0, 0, 0, .8);
    }
    .ff__combo[data-tone="crimson"] {
      color: #ff8fa3;
      text-shadow: 0 0 12px rgba(255, 45, 77, .9), 0 1px 3px rgba(0, 0, 0, .8);
    }
    /* Re-triggered per strike from the component, so the number punches on each
       hit rather than sitting still while it climbs. */
    @keyframes ffComboBeat {
      from { transform: translateY(-50%) scale(1.5); }
      to   { transform: translateY(-50%) scale(1); }
    }

    /* ── Combo: the shout ───────────────────────────────────────────────────── */
    .ff__shout {
      position: absolute; bottom: calc(100% + 8px); right: 0;
      font: 800 15px/1.15 'Orbitron', system-ui, sans-serif;
      letter-spacing: .04em; white-space: nowrap;
      color: #A78BFA;
      text-shadow: 0 0 14px rgba(139, 92, 246, .85), 0 2px 4px rgba(0, 0, 0, .9);
      pointer-events: none;
      animation: ffShout 1.5s cubic-bezier(.22, 1, .36, 1) forwards;
    }
    .ff__shout[data-tone="gold"]    { color: #ffd97a; text-shadow: 0 0 16px rgba(201, 168, 76, .95), 0 2px 4px rgba(0,0,0,.9); }
    .ff__shout[data-tone="crimson"] { color: #ff2d4d; text-shadow: 0 0 18px rgba(255, 45, 77, .95), 0 2px 4px rgba(0,0,0,.9); }
    .ff__shout--grand { font-size: 19px; }
    @keyframes ffShout {
      0%   { opacity: 0; transform: translateY(10px) scale(.85); }
      18%  { opacity: 1; transform: translateY(0) scale(1.08); }
      30%  { transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-42px) scale(1); }
    }

    /* ── Combo: what it does to the ember ───────────────────────────────────
       Held states, keyed on the tier being *stood in* rather than fired once,
       so they last exactly as long as the run does and vanish with it. */
    .ff[data-combo="2"] .ff__core,
    .ff[data-combo="3"] .ff__core { animation-duration: 2.2s; filter: brightness(1.15); }
    .ff[data-combo="4"] .ff__core,
    .ff[data-combo="5"] .ff__core { animation-duration: 1.5s; filter: brightness(1.3) saturate(1.2); }
    .ff[data-combo="6"] .ff__core,
    .ff[data-combo="7"] .ff__core { animation-duration: 1s; filter: brightness(1.45) saturate(1.35); }
    .ff[data-combo="8"] .ff__core,
    .ff[data-combo="9"] .ff__core { animation-duration: .7s; filter: brightness(1.6) saturate(1.5); }

    /* x250: the ember doubles, briefly. */
    .ff--swell .ff__btn { animation: ffSwell .9s cubic-bezier(.22, 1, .36, 1); }
    @keyframes ffSwell {
      0%   { transform: scale(1); }
      35%  { transform: scale(2); }
      100% { transform: scale(1); }
    }

    /* x100: harder and longer than the Eclipse Hammer's flinch. */
    .ff--shake .ff__btn { animation: ffShake .5s ease-in-out; }
    @keyframes ffShake {
      0%, 100% { transform: translate(0, 0); }
      10% { transform: translate(-7px, 4px); }
      25% { transform: translate(7px, -5px); }
      40% { transform: translate(-6px, -4px); }
      55% { transform: translate(6px, 5px); }
      70% { transform: translate(-4px, 2px); }
      85% { transform: translate(3px, -2px); }
    }

    /* ── Combo: the screen ──────────────────────────────────────────────────
       One fixed layer, never interactive, painting only what the current tier
       has earned. Held effects fade in on their tier and out with the run. */
    .fx {
      position: fixed; inset: 0;
      z-index: 935;
      pointer-events: none;
    }
    .fx > span { position: absolute; inset: 0; display: block; opacity: 0; }

    /* x50: purple along the edges, the whole middle left alone. */
    .fx__edge {
      background:
        linear-gradient(to right,  rgba(139, 92, 246, .5), transparent 14%),
        linear-gradient(to left,   rgba(139, 92, 246, .5), transparent 14%),
        linear-gradient(to bottom, rgba(139, 92, 246, .4), transparent 12%),
        linear-gradient(to top,    rgba(139, 92, 246, .4), transparent 12%);
      transition: opacity .5s ease;
    }
    .fx[data-level="3"] .fx__edge,
    .fx[data-level="4"] .fx__edge,
    .fx[data-level="5"] .fx__edge { opacity: .55; }
    .fx[data-level="6"] .fx__edge,
    .fx[data-level="7"] .fx__edge { opacity: .8; }
    .fx[data-level="8"] .fx__edge,
    .fx[data-level="9"] .fx__edge { opacity: 1; animation: fxEdgePulse 1.4s ease-in-out infinite; }
    @keyframes fxEdgePulse { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }

    /* x500: the corners close in. */
    .fx__vignette {
      background: radial-gradient(ellipse 78% 68% at 50% 50%, transparent 42%, rgba(76, 29, 149, .62) 100%);
      transition: opacity .6s ease;
    }
    .fx[data-level="6"] .fx__vignette,
    .fx[data-level="7"] .fx__vignette { opacity: .85; }
    .fx[data-level="8"] .fx__vignette,
    .fx[data-level="9"] .fx__vignette { opacity: 1; animation: fxVignettePulse 2.4s ease-in-out infinite; }
    @keyframes fxVignettePulse { 0%, 100% { opacity: .8; } 50% { opacity: 1; } }

    /* ── Combo: the one-shot sheets ─────────────────────────────────────────
       Each fires on the single strike that crosses its tier, so the brightest
       moments are isolated events hundreds of strikes apart. Nothing here can
       repeat at a rate that matters for photosensitivity, and the whole layer
       is switched off entirely under reduced motion. */
    .fx__sheet { opacity: 0; }

    .fx[data-burst="flash"] .fx__sheet {
      background: radial-gradient(circle at 50% 50%, rgba(255, 240, 200, .9), rgba(139, 92, 246, .5) 55%, transparent 78%);
      animation: fxFlash .5s ease-out forwards;
    }
    @keyframes fxFlash { 0% { opacity: 0; } 12% { opacity: 1; } 100% { opacity: 0; } }

    /* White, then purple floods back. The white half is 200ms and single. */
    .fx[data-burst="whiteout"] .fx__sheet {
      background: #fff;
      animation: fxWhiteout 1.5s ease-out forwards;
    }
    @keyframes fxWhiteout {
      0%   { opacity: 0;  background: #fff; }
      6%   { opacity: 1;  background: #fff; }
      20%  { opacity: 1;  background: #fff; }
      34%  { opacity: .95; background: #7b2ff7; }
      70%  { opacity: .55; background: #4c1d95; }
      100% { opacity: 0;  background: #4c1d95; }
    }

    /* The Nameless. A true inversion: difference against white flips every
       channel, which works on mobile where backdrop-filter is switched off. */
    .fx[data-burst="invert"] .fx__sheet {
      background: #fff;
      mix-blend-mode: difference;
      animation: fxInvert .2s steps(1, end) forwards;
    }
    @keyframes fxInvert { 0% { opacity: 1; } 100% { opacity: 0; } }

    .fx[data-burst="shatter"] .fx__sheet {
      background: radial-gradient(circle at 50% 50%, #fff, rgba(255, 217, 122, .8) 30%, rgba(139, 92, 246, .6) 62%, transparent 82%);
      animation: fxShatter 2.6s ease-out forwards;
    }
    @keyframes fxShatter {
      0%   { opacity: 0;   transform: scale(.2); }
      8%   { opacity: 1;   transform: scale(1); }
      45%  { opacity: .7;  transform: scale(1.1); }
      100% { opacity: 0;   transform: scale(1.3); }
    }

    /* ── The automatons ───────────────────────────────────────────────────
       One dip a second while anything is striking for you: the same squash the
       button makes under a real click, at a third of the depth so it reads as
       "something is working here" rather than as a click you did not make.

       Deliberately one beat a second at any rate. An Eclipse Automaton throws
       twenty strikes a second, and animating twenty is a strobe nobody can
       count — the number is on the HUD, where it can be read. */
    .ff--auto .ff__btn { animation: ffAuto .5s cubic-bezier(.22, 1, .36, 1); }
    @keyframes ffAuto {
      0%   { transform: scale(1); }
      28%  { transform: scale(.955); }
      100% { transform: scale(1); }
    }

    /* Eclipse Hammer: the realm flinches. Shakes the flame, not the page —
       shaking the document would move every fixed element on the site. */
    .ff--quake .ff__btn { animation: ffQuake .34s ease-in-out; }
    @keyframes ffQuake {
      0%, 100% { transform: translate(0, 0); }
      20% { transform: translate(-3px, 2px); }
      40% { transform: translate(3px, -2px); }
      60% { transform: translate(-2px, -2px); }
      80% { transform: translate(2px, 2px); }
    }

    /* ── The still versions ─────────────────────────────────────────────────
       Driven by a class off the component's own prefers-reduced-motion read,
       NOT by the media query below, and that is not a style preference.

       Angular scopes @keyframes per component — ffShoutStill becomes
       _ngcontent-<id>_ffShoutStill — but it does not rewrite an animation
       shorthand that sits inside a @media block. The reference keeps the bare
       name, matches no keyframes rule in the document, and the animation
       silently never runs: no console error, no build warning, and
       getComputedStyle still cheerfully reports it as running while
       element.getAnimations() comes back empty. The floater rule had been
       shipping in exactly that state since the flame was written.

       Both the keyframes and the reference live out here, where Angular rewrites
       the pair consistently. */
    @keyframes ffFadeOnly { from { opacity: 1; } to { opacity: 0; } }
    @keyframes ffShoutStill {
      0%   { opacity: 0; }
      15%  { opacity: 1; }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
    /* The floater still says what was earned; it just stops travelling. */
    .ff--still .ff__float { animation: ffFadeOnly 1s linear forwards; }
    /* The shout still names the tier; it stops rising. */
    .ff--still .ff__shout { animation: ffShoutStill 2s linear forwards; }

    /* ── Mobile: bigger, and under the thumb rather than beside it ─────────
         Every rule in both queries is written against .ff:not(.ff--inline).
         No backticks anywhere in these comments: they sit inside the styles
         template literal, and one would end the string — the same trap the
         note above the button describes, and it catches every edit to this
         block.

         The inline flame is position: relative, and the bottom property on a
         relatively positioned element is an offset, not an anchor — the rule
         in the 960px query below
         used to apply to it too and shunted the Forge View's centrepiece
         ~94px up and out of its own panel on every phone. It reads as a
         layout bug with no obvious cause, because the rule that causes it
         names a class the element is not supposed to match. */
    /* The five-tab bar appears at 960px, not 768px, so the flame has to clear
       it from 960px down — otherwise between 769 and 960 it sits behind the
       CODEX and PROFILE tabs. Kept as its own query so the size changes below
       still happen at the phone breakpoint where they belong. */
    @media (max-width: 960px) {
      .ff:not(.ff--inline) { bottom: calc(58px + env(safe-area-inset-bottom, 0px) + 18px); }
    }

    @media (max-width: 768px) {
      /* Bottom-centre, not bottom-right. A corner is where you put a thing you
         want out of the way, and on a phone the Godforge's one interaction was
         pinned under the right edge where a right thumb has to reach across its
         own hand and a left thumb cannot reach at all. Centred, it is the
         easiest point on the screen to hit repeatedly, which is what a clicker
         needs to be.

         The offset stays the calc from the 960px query above rather than the
         flat 70px it is tempting to write here: the five-tab bar is 58px PLUS
         env(safe-area-inset-bottom), which is 34px on a home-indicator iPhone.
         A hard 70px would put the ember on top of the middle tab on exactly the
         devices this hotfix is for, and the tab it would cover is a navigation
         control — a worse bug than the one being fixed. */
      .ff:not(.ff--inline) {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
      /* 80px, up from 52px. The old size cleared the 44px minimum but only
         just, and this is a target meant to be hit dozens of times in a row. */
      .ff:not(.ff--inline) .ff__btn { width: 80px !important; height: 80px !important; }
      .ff:not(.ff--inline) .ff__glyph { width: 44px !important; height: 44px !important; }
      .ff--inline .ff__btn { width: 52px !important; height: 52px !important; }
      .ff--inline .ff__glyph { width: 30px !important; height: 30px !important; }

      .ff__hud, .ff__banner { min-width: 154px; font-size: 11px; }
      /* The counter shares the row with the ember on a 375px viewport. */
      .ff__combo { font-size: 13px; right: calc(100% + 7px); }
      .ff__shout { font-size: 13px; }
      .ff__shout--grand { font-size: 15px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ff__core, .ff__ring, .ff__ring--outer, .ff__btn::after { animation: none !important; }
      .ff__core { filter: brightness(1.1); }
      .ff__spark { display: none; }
      .ff--quake .ff__btn { animation: none; }
      .ff__banner, .ff__hud { animation: none; transition: none; }
      /* The two rules that name a keyframes live outside this block — see the
         note up by ffFadeOnly. Everything here either cancels an animation or
         hides an element, neither of which needs a name resolved. */

      /* ── The combo under reduced motion ─────────────────────────────────
         The ladder is kept; the spectacle is not. The counter and every shout
         still read, so somebody can still see they are at x1,000 and still
         collect all eight achievements — what goes is the shake, the swell,
         the flash, the whiteout and the inversion, which are the only parts
         that were ever a problem. The whole screen layer is removed rather
         than dimmed: there is no gentler version of a full-viewport flash. */
      .fx { display: none; }
      .ff--shake .ff__btn, .ff--swell .ff__btn, .ff--auto .ff__btn { animation: none; }
      .ff__combo { animation: none; }
      .ff[data-combo] .ff__core { animation: none !important; }
    }
  `],
})
export class ForgeFlameComponent implements OnInit, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly idle = inject(IdleService);
  private readonly comboSvc = inject(ComboService);
  private readonly audio = inject(ForgeAudioService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inlineFlame = inject(InlineFlameService);
  private readonly router = inject(Router);
  private readonly subs = new Subscription();

  /**
   * Render in the page rather than pinned to the corner.
   *
   * Set by the Forge View, which wants the flame at the centre of its forge
   * panel. Claiming the registry on init is what stands the corner flame down
   * for as long as this one is mounted.
   */
  @Input() inline = false;

  snap: EconomySnapshot = this.economy.snapshot;
  hudOpen = false;
  quaking = false;
  banner: Banner | null = null;
  announcement = '';

  floaters: Floater[] = [];
  sparks: Spark[] = [];

  /** The live run. Zero between runs, which hides the counter entirely. */
  combo: ComboSnapshot = this.comboSvc.snapshot;
  shouts: Shout[] = [];
  /** 1-9 for the tier being held, 0 for none. Drives every held effect in CSS. */
  comboLevel = 0;
  /** The one-shot currently painting the screen layer, or null. */
  burst: ComboEffect | 'invert' | null = null;
  shaking = false;
  swelling = false;
  /** One dip a second while the automatons are running. */
  autoBeat = false;
  /** Mounts the site-wide confetti hook for one beat at the top of the ladder. */
  shattered = false;

  private seq = 0;
  /** Read once from the platform query; drives the .ff--still class in the template. */
  reducedMotion = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    if (this.inline) this.inlineFlame.claim();

    this.economy.init();
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));

    // The run itself, including the drop back to zero when the fuse burns out —
    // which is how the counter and every held effect disappear together.
    this.subs.add(this.comboSvc.snapshot$.subscribe(c => {
      this.combo = c;
      this.comboLevel = c.tier ? COMBO_TIERS.indexOf(c.tier) + 1 : 0;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.comboSvc.event$.subscribe(e => this.onComboEvent(e)));

    // The automatons, made visible. This fires once a second whatever the rate,
    // and only when the tab is in front — the service does not emit at all on a
    // hidden one, so nothing here is animating into a background tab.
    this.subs.add(this.economy.autoStrike$.subscribe(() => this.onAutoStrike()));

    if (this.isBrowser) {
      this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    }
  }

  ngOnDestroy(): void {
    if (this.inline) this.inlineFlame.release();
    this.onPressEnd();
    this.subs.unsubscribe();
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  get gold(): string { return formatCurrency(this.snap.gold); }
  get essence(): string { return formatCurrency(this.snap.essence); }
  get rate(): string { return formatCompact(this.snap.perSecond); }
  get autoRate(): string { return formatRate(this.snap.autoPerSecond); }

  get label(): string {
    const auto = this.snap.autoPerSecond > 0
      ? ` ${this.autoRate} automatic strikes a second.`
      : '';
    // The HUD is aria-hidden, so its two links are invisible to a screen
    // reader. The Rune Forge is named here instead — it is the one destination
    // a visitor cannot otherwise discover from this control.
    return `The Forge Flame. ${formatCurrency(this.snap.gold)} Gold, earning ${this.rate} a second. `
      + `Strike for ${this.snap.perClick} Gold.${auto} Press and hold to open the Rune Forge.`;
  }

  /**
   * One beat of the automatons.
   *
   * A dip and two sparks — no floater, no sound, no combo. The Gold is already
   * in the per-second rate and has already been paid; this is the forge looking
   * busy, which is the only thing a machine you bought should be allowed to
   * take from the Flame's vocabulary. Skipped under reduced motion, where a
   * once-a-second pulse in the corner of every page is exactly the sort of
   * thing the preference is asking us not to do.
   */
  private onAutoStrike(): void {
    if (this.reducedMotion || this.autoBeat) return;
    this.autoBeat = true;
    this.sparkBurst(2);
    this.after(() => { this.autoBeat = false; this.cdr.markForCheck(); }, 520);
    this.cdr.markForCheck();
  }

  // ── The Rune Forge gesture ─────────────────────────────────────────────────

  /** ms a press has to be held before it means "open the Rune Forge". */
  private static readonly LONG_PRESS_MS = 450;

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set when a press has already been spent opening the forge. */
  private pressed = false;

  onPressStart(): void {
    if (!this.isBrowser) return;
    this.pressed = false;
    if (this.pressTimer !== null) clearTimeout(this.pressTimer);
    // Outside the zone: the common case is a normal strike, where this timer is
    // cancelled a moment later and should never have cost a change detection.
    this.zone.runOutsideAngular(() => {
      this.pressTimer = setTimeout(() => {
        this.pressTimer = null;
        this.pressed = true;
        this.zone.run(() => this.goToRuneForge());
      }, ForgeFlameComponent.LONG_PRESS_MS);
    });
  }

  onPressEnd(): void {
    if (this.pressTimer !== null) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  /** Right-click, or the press-and-hold that raises the same event on touch. */
  openRuneForge(event: Event): void {
    event.preventDefault();
    this.onPressEnd();
    this.pressed = true;
    this.goToRuneForge();
  }

  private goToRuneForge(): void {
    this.pressed = true;
    this.audio.coin();
    void this.router.navigateByUrl('/rune-forge');
  }

  // ── Touch ──────────────────────────────────────────────────────────────────

  /** Drives the squash on touch, where :active never arrives. See the CSS. */
  tapping = false;
  private tapSeq = 0;

  /**
   * When the last touch paid a strike. Read by `onStrike` to throw away the
   * compatibility click.
   *
   * A preventDefaulted touchstart is *supposed* to suppress the click entirely,
   * and in every browser that follows the spec it does — but "the click did not
   * fire" is not something this component can check, and a strike paid twice
   * for one tap is the bug the report actually leads with ("no ghost clicks or
   * double-fires"). So the click path is guarded by a window rather than
   * trusted: the compatibility click lands within ~300ms of the touch that
   * spawned it, 700ms is comfortably past that, and it is far short of the
   * interval between two deliberate taps by a real thumb.
   */
  private lastTouchAt = 0;

  /**
   * The strike, on touchstart instead of click.
   *
   * Two reasons, and only one of them is speed. Speed is the obvious one —
   * touchstart is the first event of the gesture and click is the last, and on
   * a button whose entire job is being hit repeatedly the gap is felt. The
   * other is that preventDefaulting here is what stops the press ever becoming
   * something else: no compatibility mouse event, no text selection, and no
   * drag started from the glyph.
   *
   * Bound on the button, not on the host. A @HostListener('touchstart') with a
   * preventDefault would cover the whole component — including the HUD's two
   * routerLinks — and a preventDefaulted touchstart on an anchor is an anchor
   * that cannot be followed by a finger. The Market and the Rune Forge would
   * have become desktop-only links, quietly.
   */
  onTouchStrike(e: TouchEvent): void {
    if (!this.isBrowser) return;
    // A second finger is a pinch or a stray palm, not a strike. Left alone
    // rather than preventDefaulted so the page can still be zoomed from here.
    if (e.touches.length > 1) return;

    e.preventDefault();
    this.lastTouchAt = Date.now();

    // Held for a fixed 110ms rather than until touchend, and that is the whole
    // reason this is not simply :active with a different name. A deliberate tap
    // on a clicker is 30-60ms of contact; releasing the class on touchend would
    // put the squash on screen for less than two frames on a fast tap and for
    // none at all on the fastest, so the taps that most need to feel answered
    // would be the ones that felt like nothing. The token guards the overlap:
    // a second tap inside the window owns the class, and the first tap's timer
    // finds a newer token and leaves it alone.
    const token = ++this.tapSeq;
    this.tapping = true;
    this.after(() => {
      if (this.tapSeq !== token) return;
      this.tapping = false;
      this.cdr.markForCheck();
    }, 110);

    this.buzz();
    this.strike();
    this.cdr.markForCheck();
  }

  /**
   * 10ms. Long enough to register as a tick under the finger, short enough that
   * a run of them reads as texture rather than as the phone going off.
   *
   * Guarded on both sides: `vibrate` is absent on every iOS browser, and on the
   * ones that have it a call outside a user gesture throws rather than
   * returning false. This is inside a gesture, but a NotAllowedError from a
   * decoration must never be the thing that stops a strike from paying.
   */
  private buzz(): void {
    try { navigator.vibrate?.(10); } catch { /* haptics are optional */ }
  }

  // ───────────────────────────────────────────────────────────────────────────

  onStrike(): void {
    // The compatibility click behind a touch that has already paid. See
    // `lastTouchAt`.
    if (Date.now() - this.lastTouchAt < 700) return;

    // A press that has already been spent opening the Rune Forge is not also a
    // strike. Cleared here rather than in the press handlers because `click`
    // fires after `pointerup`, so this is the last word on the gesture.
    if (this.pressed) { this.pressed = false; return; }

    this.strike();
  }

  /** The strike itself, once a gesture has been judged to be one. */
  private strike(): void {

    // One flame, two ledgers.
    //
    // The Ambient Forge shipped its own flame in the header, paying XP for the
    // same swing this one pays Gold for. Two clickable flames on the same page
    // is two answers to "what does striking the forge do", so that one was
    // retired and this one drives both: `IdleService.strike()` keeps the XP, the
    // Century Strike XP, and the two strike-count achievements
    // ('idle-forge-striker' at a thousand, 'idle-obsidian-hammer' at ten
    // thousand) exactly as they were before the Market existed.
    //
    // Called first and unconditionally: it enforces its own cooldown, and a
    // visitor must not lose XP because the Gold ledger happened to say no.
    this.idle.strike();

    const hit = this.economy.strike();
    // Inside the cooldown. Silently ignored rather than flashed — a held mouse
    // button would otherwise strobe the whole corner of the screen.
    if (!hit) return;

    // The strike paid, so it counts toward the run. Everything the combo does —
    // the counter, the shouts, the screen — hangs off the event this emits.
    const run = this.comboSvc.strike();

    this.announcement = `+${hit.gold} Gold. ${formatCurrency(this.snap.gold)} total.`
      + (run.count > 1 ? ` Combo ${run.count}.` : '');
    this.pushFloater(`+${hit.gold}`, hit.century || hit.millennium);

    if (hit.millennium) {
      this.showBanner({
        title: 'MILLENNIUM FORGE',
        sub: `${formatCurrency(hit.count)} strikes. The anvil remembers.`,
        grand: true,
      }, 4_600);
      this.audio.century();
      this.sparkBurst(22);
    } else if (hit.century) {
      this.showBanner({
        title: 'Century Strike!',
        sub: `${formatCurrency(hit.count)} strikes — +10 bonus Gold.`,
        grand: false,
      }, 3_000);
      this.audio.century();
      this.sparkBurst(16);
    } else if (hit.count % 10 === 0) {
      this.audio.strike(pitchFor(run.count));
      this.sparkBurst(10);
    } else {
      // Pitched by the tier being held, so the ladder is audible on every
      // ordinary strike rather than only on the ones that cross a threshold.
      this.audio.strike(pitchFor(run.count));
      this.sparkBurst(4);
    }

    // The Eclipse Hammer's screen shake, scoped to the flame.
    if (this.snap.hammerVisual === 'quake' && !this.reducedMotion) {
      this.quaking = true;
      this.after(() => { this.quaking = false; this.cdr.markForCheck(); }, 360);
    }

    this.cdr.markForCheck();
  }

  // ───────────────────────────────────────────────────────────────────────────

  /** The colour the counter is wearing: the held tier's, or purple before one. */
  get comboTone(): ComboTone {
    return this.combo.tier?.tone ?? 'purple';
  }

  /**
   * The counter as a one-or-zero-length list, so `@for`'s tracking does the
   * animation restart for us. Empty below x2, which hides it entirely.
   */
  get comboBadge(): number[] {
    return this.combo.count > 1 ? [this.combo.count] : [];
  }

  /**
   * React to a rung being crossed: shout it, play it, and paint it.
   *
   * The sound fires regardless of reduced motion — `ForgeAudioService` makes its
   * own decision there, and it suppresses on the same query — while everything
   * that moves is gated here. The achievement has already been banked by the
   * service before this runs, so the rarity drop and this shout land together.
   */
  private onComboEvent(e: ComboEvent): void {
    if (e.nameless) {
      this.pushShout(NAMELESS_LABEL, 'crimson', true);
      this.audio.comboNameless();
      this.paint('invert', 220);
      this.cdr.markForCheck();
      return;
    }

    const tier = e.tier;
    if (!tier) return;

    this.pushShout(tier.label, tier.tone, tier.at >= 500);

    // The top three rungs get their own cue; the rest ride the tier flourish.
    if (tier.effect === 'shatter') this.audio.comboAscension();
    else if (tier.effect === 'flash' || tier.effect === 'whiteout') this.audio.comboImpact();
    else this.audio.comboTier(tier.semitones);

    switch (tier.effect) {
      case 'shake':
        this.shaking = true;
        this.after(() => { this.shaking = false; this.cdr.markForCheck(); }, 520);
        this.sparkBurst(20);
        break;
      case 'swell':
        this.swelling = true;
        this.after(() => { this.swelling = false; this.cdr.markForCheck(); }, 920);
        break;
      case 'flash':
        this.paint('flash', 520);
        this.sparkBurst(24);
        break;
      case 'whiteout':
        this.paint('whiteout', 1_520);
        break;
      case 'shatter':
        this.paint('shatter', 2_620);
        this.sparkBurst(28);
        // Mount, then unmount: the engine's observer fires on the node being
        // added, so leaving it in the DOM would celebrate exactly once and then
        // never again for the rest of the session.
        this.shattered = true;
        this.after(() => { this.shattered = false; this.cdr.markForCheck(); }, 400);
        break;
      // 'pop', 'surge', 'edge' and 'vignette' are all held states driven off
      // `comboLevel` in CSS — they have nothing to fire here.
      default:
        break;
    }

    this.cdr.markForCheck();
  }

  /**
   * Run a one-shot across the screen layer.
   *
   * Every one of these is suppressed under reduced motion. There is no gentler
   * version of a full-viewport flash to fall back to, so the fallback is nothing
   * — the shout still names the tier and the achievement still drops.
   */
  private paint(effect: ComboEffect | 'invert', ms: number): void {
    if (this.reducedMotion) return;
    this.burst = effect;
    this.after(() => { this.burst = null; this.cdr.markForCheck(); }, ms);
  }

  private pushShout(text: string, tone: ComboTone, grand: boolean): void {
    const key = this.seq++;
    this.shouts = [...this.shouts, { key, text, tone, grand }];
    this.after(() => {
      this.shouts = this.shouts.filter(s => s.key !== key);
      this.cdr.markForCheck();
    }, 2_100);
  }

  private pushFloater(text: string, big: boolean): void {
    const key = this.seq++;
    // Spread across ±18px so a fast clicker gets a scatter rather than a column.
    const dx = Math.round((Math.random() - 0.5) * 36);
    this.floaters = [...this.floaters, { key, text, dx, big }];
    this.after(() => {
      this.floaters = this.floaters.filter(f => f.key !== key);
      this.cdr.markForCheck();
    }, 1_150);
  }

  /**
   * Fire `count` sparks outward on random vectors.
   *
   * Skipped entirely under reduced motion — this is the one effect with no
   * meaningful static form. The floater and the payout both still happen.
   */
  private sparkBurst(count: number): void {
    if (this.reducedMotion) return;

    const made: Spark[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 26 + Math.random() * (count > 12 ? 46 : 20);
      made.push({
        key: this.seq++,
        x: Math.round(Math.cos(angle) * dist),
        y: Math.round(Math.sin(angle) * dist),
        delay: Math.round(Math.random() * 90),
      });
    }
    this.sparks = [...this.sparks, ...made];

    const keys = new Set(made.map(s => s.key));
    this.after(() => {
      this.sparks = this.sparks.filter(s => !keys.has(s.key));
      this.cdr.markForCheck();
    }, 780);
  }

  private showBanner(banner: Banner, ms: number): void {
    this.banner = banner;
    this.after(() => { this.banner = null; this.cdr.markForCheck(); }, ms);
  }

  /**
   * A tracked `setTimeout` outside the zone. Every one of these fires purely to
   * remove a decoration; letting zone.js schedule them would cost a full change
   * detection pass per spark, and there are twenty-two of them on a Millennium.
   */
  private after(fn: () => void, ms: number): void {
    this.zone.runOutsideAngular(() => {
      const id = setTimeout(() => {
        this.timers.delete(id);
        this.zone.run(fn);
      }, ms);
      this.timers.add(id);
    });
  }
}
