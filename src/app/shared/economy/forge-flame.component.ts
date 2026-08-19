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
  ElementRef,
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
import { ForgeMode, ForgeModeService } from './forge-mode.service';
import { IdleService } from '../idle/idle.service';
import { ComboEvent, ComboService, ComboSnapshot } from './combo.service';
import {
  COMBO_TIERS,
  ComboEffect,
  ComboTone,
  NAMELESS_LABEL,
  pitchFor,
} from './combo.model';
import { ForgeSceneService } from '../forge-scene/forge-scene.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import type { RuneFind } from '../rune-forge/rune-forge.service';
import {
  RUNE_TIER_ORDER,
  STRIKE_COST,
  tierOf,
} from '../rune-forge/rune.model';
import type { RuneTier } from '../rune-forge/rune.model';
import { isHeavyTier } from '../rune-forge/rune-haul';

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

/**
 * How many runes the corner's bulk button strikes.
 *
 * Ten, and only ten. The Rune Forge page offers x10 / x100 / x1000 because it
 * has a reveal to land them in, a progress bar and a Stop button; a corner
 * widget has none of those, and x100 from a 64px control is a seven-figure
 * spend behind one tap with nothing to read afterwards. The page is one hold
 * away and is where a run that size belongs.
 */
export const FORGE_BULK = 10;

/**
 * The rarity at which a find stops being a drop and becomes an event.
 *
 * Rare is where the Rune Forge's own auto-roll stops, and it is the same line
 * here: at and above it the name comes in bigger, wearing its glow, and the
 * screen takes a flash. Below it the haul is a quiet list.
 */
export const FORGE_FLASH_TIER: RuneTier = 'rare';

/**
 * One rune, named in its own rarity colour, rising off the anvil.
 *
 * The Gold face's floater says a number, because a number is the whole payout.
 * The anvil's payout is a *thing*, and the only part of it worth putting on a
 * corner widget is which thing — so this carries the name and the tier's colour
 * and nothing else. The rest of the find (the sigil, the scroll, the explorer)
 * has already been banked and is on the Rune Forge page, which is one hold
 * away.
 */
interface LootDrop {
  key: number;
  name: string;
  /** The tier's colour, straight off `RUNE_TIERS`. Never invented here. */
  color: string;
  glow: string;
  /** Rare and above: bigger, haloed, and worth a flash of the screen. */
  grand: boolean;
  /** First of its kind — the drop wears a NEW flag. */
  isNew: boolean;
  /** 2 when worn strikePower sheared a second copy off the blow. */
  copies: number;
  /** Horizontal scatter, as the Gold floater does. */
  dx: number;
  /**
   * Vertical stagger, in px, so a bulk run stacks instead of overprinting.
   *
   * A x10 lands ten drops inside one frame. Without this they are ten labels
   * on the same 14px line, which reads as one flickering label — the offset is
   * what makes it a haul.
   *
   * Negative: the stack builds *upward*, away from the ember. Staggering
   * downward put the tenth drop of a x10 135px below the top of a button that
   * sits 26px off the bottom of the viewport, so the back half of every bulk
   * run was drawn off the bottom of the screen. Up is also the direction the
   * drops travel, so the stack reads as a column already in flight.
   */
  dy: number;
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
      [attr.data-mode]="mode"
      [class.ff--quake]="quaking"
      [class.ff--shake]="shaking"
      [class.ff--swell]="swelling"
      [class.ff--auto]="autoBeat"
      [class.ff--broke]="broke"
      [class.ff--still]="reducedMotion">

      <!-- The switch.
           A real <button role="switch">, not a checkbox dressed as one: there is
           no form here and nothing to submit, and role="switch" is the one
           pattern that announces both the name and the on/off state in a single
           read. aria-checked tracks the anvil, so "Anvil mode, switch, on" is
           what a screen reader says.

           Above the ember rather than beside it. Beside is where the combo
           counter lives on the left and the viewport edge is on the right, and
           on a phone the flame is centred at the bottom with a tab bar under it
           — above is the only side with room on both layouts. Everything that
           used to sit at "just above the button" (the HUD, the banner, the
           shout) is offset past it in the CSS. -->
      <div class="ff__controls">
        <!-- Bulk, from the corner. The Rune Forge page grew x10 / x100 / x1000
             in v2.64.0 and the ember is the same anvil; ten is the one worth
             putting on a widget. x100 from a 64px corner control is a five-
             figure spend behind a single tap with no reveal to read, and the
             page — one hold away — is where a run that size belongs.

             Only in anvil mode, and disabled when the purse cannot pay for a
             single strike. Ten strikes is ~12ms even on the eviction path, so
             this runs straight through rather than chunking the way the page
             does for its thousand. -->
        @if (anvil) {
          <button
            type="button"
            class="ff__bulk"
            [disabled]="!canForge"
            [attr.aria-label]="bulkLabel"
            (click)="onBulk()">x10</button>
        }

        <button
          type="button"
          class="ff__mode"
          role="switch"
          [attr.aria-checked]="anvil"
          [attr.aria-label]="modeLabel"
          (click)="toggleMode()">
          <span class="ff__mode-track" aria-hidden="true">
            <span class="ff__mode-icon ff__mode-icon--gold">✦</span>
            <span class="ff__mode-icon ff__mode-icon--anvil">⚒</span>
            <span class="ff__mode-knob"></span>
          </span>
        </button>
      </div>

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
        <span class="ff__combo" [attr.data-tone]="comboTone" aria-hidden="true">
          @if (anvil) { <b class="ff__combo-word">FORGE</b> }x{{ c }}
        </span>
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
        @if (anvil) {
          <span class="ff__hud-cost" [class.ff__hud-cost--broke]="!canForge">
            ⚒ {{ strikeCost }} <img class="ff__hud-coin gf-icon currency-icon" src="assets/icons/currencies/gold.png" alt="" aria-hidden="true" width="13" height="13" decoding="async" draggable="false"> a strike
          </span>
          <span class="ff__hud-hint">Click to strike a rune · hold for the anvil</span>
        } @else {
          <span class="ff__hud-hint">Click to forge · hold for runes</span>
        }
        @if (snap.essence > 0) {
          <span class="ff__hud-essence"><img class="gf-icon currency-icon currency-icon--essence" src="assets/icons/currencies/essence.png" alt="" aria-hidden="true" width="13" height="13" decoding="async" draggable="false"> {{ essence }} Essence</span>
        }
        <a class="ff__hud-forge" routerLink="/forge/runes">Strike the Rune Forge &rarr;</a>
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

        <!-- The flip.
             Two faces on one card: the ember on the front, the anvil half a
             turn behind it. .ff__face carries preserve-3d and the rotation;
             each side is flat and backface-hidden, which is what makes the
             turn read as one object rather than two crossfading ones.

             The sides hold their own core, rings and glyph rather than sharing
             one set, because sharing would mean recolouring the ember mid-turn
             — the colour would change at the halfway point, in view, instead of
             arriving with the face that owns it. Every tier, hammer and combo
             rule below is written against .ff__core / .ff__ring / .ff__glyph as
             descendants, so both faces grow with the forge without a single
             extra rule.

             The sparks stay OUTSIDE the face. They fly out past the button's
             edge on random vectors, and a spark inside a preserve-3d subtree
             that is mid-rotation flies out along the rotated plane — a burst
             that visibly leans. Out here they are flat against the screen,
             which is what a spark is. -->
        <span class="ff__face" aria-hidden="true">
          <span class="ff__side ff__side--gold">
            <span class="ff__core"></span>
            <span class="ff__ring"></span>
            <span class="ff__ring ff__ring--outer"></span>
            <img class="ff__glyph forge-flame" src="assets/icons/forge-flame-128.png"
                 alt="" aria-hidden="true" width="34" height="34"
                 decoding="async" draggable="false">
          </span>

          <!-- The anvil is drawn, not fetched. It is a UI glyph rather than a
               piece of world art, and the asset library reserves SVG for
               exactly that — a raster anvil would have to go through the import
               pipeline, ship a 128px PNG, and still not take the tier colour.
               Inline, it inherits currentColor and turns violet with the rest
               of the face. -->
          <span class="ff__side ff__side--anvil">
            <span class="ff__core"></span>
            <span class="ff__ring"></span>
            <span class="ff__ring ff__ring--outer"></span>
            <svg class="ff__glyph ff__anvil" viewBox="0 0 32 32" width="34" height="34"
                 fill="none" aria-hidden="true" focusable="false">
              <!-- Four shapes, not one path. An anvil is only legible at 34px if
                   the three masses read separately: a wide face with the horn
                   tapering to a point on the left, a narrow column under it, and
                   a base wider than the column but narrower than the face. Drawn
                   as one outline the waist closes up and the whole thing reads
                   as an hourglass. -->
              <!-- Face and horn. The taper is symmetric about y=10, which is
                   what makes the left end a point rather than a blunt end. -->
              <path d="M27.4 7.2v5.6H11.5C7.6 12.8 4.2 11.9 1.4 10c2.8-1.9 6.2-2.8 10.1-2.8Z"
                    fill="currentColor"/>
              <!-- The column. Straight sided and narrow — the gap either side of
                   it is what separates the face from the base. -->
              <path d="M13.2 12.8h5.6V20h-5.6Z" fill="currentColor" opacity=".88"/>
              <!-- Base, flaring. -->
              <path d="M7 20h18l1.6 5H5.4Z" fill="currentColor" opacity=".76"/>
              <!-- The lit edge along the top of the face, so the plate reads as
                   a surface. White at a third, over whatever colour the side is
                   wearing. -->
              <path d="M27.4 7.2v1.4H11.5c-1.9 0-3.7-.2-5.5-.7 1.8-.5 3.6-.7 5.5-.7Z"
                    fill="#fff" opacity=".34"/>
            </svg>
          </span>
        </span>

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

      <!-- The haul. One label per rune, in the rune's own rarity colour, rising
           off the anvil and gone in a second and a half. --dy staggers a bulk
           run so ten drops read as ten things rather than as one flickering
           line. -->
      @for (d of loot; track d.key) {
        <span class="ff__loot"
              [class.ff__loot--grand]="d.grand"
              [style.--dx.px]="d.dx"
              [style.--dy.px]="d.dy"
              [style.--loot-color]="d.color"
              [style.--loot-glow]="d.glow"
              aria-hidden="true">
          @if (d.isNew) { <b class="ff__loot-new">NEW</b> }
          {{ d.name }}@if (d.copies > 1) { <i class="ff__loot-copies">×{{ d.copies }}</i> }
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
    .ff > .ff__loot,
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

    /* ═══ THE SECOND FACE ═══════════════════════════════════════════════════
       Everything from here to the tier block is the anvil: the flip, the
       switch that drives it, the violet the ember turns, and the haul that
       comes off it.
       ═══════════════════════════════════════════════════════════════════════ */

    /* ── The flip ───────────────────────────────────────────────────────────
       preserve-3d on the card, backface-visibility on each side. The rotation
       is on the card so both sides turn together; the anvil is pre-rotated a
       half turn so it faces the viewer at the end of the move.

       The perspective lives on the button rather than on .ff. A perspective is
       a containing block for fixed descendants, and .ff has one child that is
       genuinely fixed — no it does not, the screen layer is a sibling — but it
       also carries the translateX(-50%) that centres the flame on a phone, and
       stacking a perspective on top of that is one more thing to reason about
       every time this corner moves. On the button it covers exactly the card
       it is there for. */
    .ff__btn { perspective: 520px; }

    .ff__face {
      position: absolute; inset: 0;
      transform-style: preserve-3d;
      transition: transform .6s cubic-bezier(.22, 1, .36, 1);
    }
    .ff[data-mode="anvil"] .ff__face { transform: rotateY(180deg); }

    .ff__side {
      position: absolute; inset: 0;
      display: grid; place-items: center;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .ff__side--anvil { transform: rotateY(180deg); }

    /* The anvil glyph is an SVG and takes currentColor, so the whole silhouette
       moves with the side's tint instead of needing a second file per state. */
    .ff__anvil { color: #ddd2ff; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, .7)); }

    /* ── The anvil ember ────────────────────────────────────────────────────
       Violet where the Gold face is orange, and it has to be written once per
       tier rather than once overall: the tier rules below are
       .ff[data-tier="N"] .ff__core, which outranks a bare .ff__side--anvil
       .ff__core, so a tier-4 forge would have shown an orange anvil. Each rule
       here carries the tier attribute for the same weight plus the side class.

       Not done with a hue-rotate on the side, which would have been one rule:
       a filter forces its own element into a flattened group, and a flattened
       group is exactly where backface-visibility has historically stopped
       working. The face would have shown both sides at once on the browsers
       that get it wrong, and only on the anvil. */
    .ff__side--anvil .ff__core {
      background:
        radial-gradient(circle at 36% 30%, #f3edff 0%, #A78BFA 22%, #7b61ff 58%, #2a1257 92%);
      box-shadow:
        0 0 18px rgba(139, 92, 246, .6),
        0 0 44px -8px rgba(167, 139, 250, .55),
        inset 0 -4px 10px rgba(0, 0, 0, .45);
    }
    .ff[data-tier="3"] .ff__side--anvil .ff__core {
      box-shadow: 0 0 26px rgba(139, 92, 246, .75), 0 0 64px -8px rgba(167, 139, 250, .7), inset 0 -4px 10px rgba(0, 0, 0, .45);
    }
    .ff[data-tier="4"] .ff__side--anvil .ff__core {
      background: radial-gradient(circle at 36% 30%, #fbf7ff 0%, #cbb8ff 20%, #7b61ff 55%, #3d1a6b 94%);
      box-shadow: 0 0 32px rgba(139, 92, 246, .85), 0 0 80px -10px rgba(255, 109, 215, .45), inset 0 -4px 12px rgba(0, 0, 0, .5);
    }
    .ff[data-tier="5"] .ff__side--anvil .ff__core {
      background: radial-gradient(circle at 36% 30%, #ffffff 0%, #e6dcff 16%, #7b61ff 50%, #ff6dd7 96%);
      box-shadow: 0 0 40px rgba(167, 139, 250, .95), 0 0 110px -12px rgba(255, 109, 215, .55), inset 0 -5px 14px rgba(0, 0, 0, .5);
    }
    .ff__side--anvil .ff__ring { border-color: rgba(139, 92, 246, .5); }
    .ff__side--anvil .ff__ring--outer { border-color: rgba(167, 139, 250, .32); }
    .ff[data-tier="5"] .ff__side--anvil .ff__ring { border-color: rgba(214, 200, 255, .85); }

    /* The held-glow, which is on the button and therefore shared by both
       faces — so it has to be re-tinted for the mode rather than for the side. */
    .ff[data-mode="anvil"] .ff__btn:active,
    .ff[data-mode="anvil"] .ff__btn:hover {
      filter: brightness(1.18) drop-shadow(0 0 16px rgba(139, 92, 246, .8));
    }

    /* ── The controls row ───────────────────────────────────────────────────
       The switch, and the x10 beside it in anvil mode. Right-aligned with the
       button on a pointer device, where the space is to the left; centred on a
       phone, where the flame itself is centred.

       --ff-controls-h is what everything that used to sit "just above the
       button" now clears. Changing the row's height in one place moves the
       HUD, the banner and the shout with it. */
    .ff { --ff-controls-h: 40px; }

    .ff__controls {
      position: absolute;
      bottom: calc(100% + 8px);
      right: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      height: var(--ff-controls-h);
    }

    /* Padding, not size: the track is a 28px pill and the button around it is
       the 44px target the touch rules ask for. A 28px switch is legible and
       unhittable; a 44px switch is hittable and looks like a second button. */
    .ff__mode {
      display: grid; place-items: center;
      padding: 6px;
      border: none;
      background: none;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .ff__mode:focus-visible { outline: 2px solid #A78BFA; outline-offset: 2px; border-radius: 999px; }

    .ff__mode-track {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      place-items: center;
      width: 58px; height: 28px;
      border-radius: 999px;
      border: 1px solid rgba(201, 168, 76, .38);
      background: rgba(8, 5, 18, .92);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, .6), 0 0 14px -6px rgba(232, 117, 42, .7);
      transition: border-color .35s ease, box-shadow .35s ease;
    }
    .ff[data-mode="anvil"] .ff__mode-track {
      border-color: rgba(139, 92, 246, .55);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, .6), 0 0 16px -5px rgba(139, 92, 246, .85);
    }

    .ff__mode-icon {
      position: relative; z-index: 1;
      font-size: 12px; line-height: 1;
      transition: color .35s ease, opacity .35s ease;
    }
    .ff__mode-icon--gold  { color: #ffd97a; opacity: 1;   }
    .ff__mode-icon--anvil { color: #7d918c; opacity: .55; }
    .ff[data-mode="anvil"] .ff__mode-icon--gold  { color: #7d918c; opacity: .55; }
    .ff[data-mode="anvil"] .ff__mode-icon--anvil { color: #ddd2ff; opacity: 1;   }

    /* The knob travels; the icons stay put and change weight underneath it.
       Half the track minus the border, so it lands centred over either icon. */
    .ff__mode-knob {
      position: absolute; top: 2px; left: 2px;
      width: 26px; height: 22px;
      border-radius: 999px;
      background: radial-gradient(circle at 40% 32%, rgba(255, 243, 214, .55), rgba(232, 117, 42, .32) 70%, transparent);
      box-shadow: 0 0 10px -2px rgba(232, 117, 42, .8);
      transition: transform .38s cubic-bezier(.22, 1, .36, 1), background .35s ease, box-shadow .35s ease;
    }
    .ff[data-mode="anvil"] .ff__mode-knob {
      transform: translateX(28px);
      background: radial-gradient(circle at 40% 32%, rgba(243, 237, 255, .6), rgba(123, 97, 255, .38) 70%, transparent);
      box-shadow: 0 0 12px -2px rgba(139, 92, 246, .9);
    }

    /* ── x10 ────────────────────────────────────────────────────────────── */
    .ff__bulk {
      min-height: 28px;
      padding: 5px 9px;
      border-radius: 999px;
      border: 1px solid rgba(139, 92, 246, .5);
      background: rgba(10, 6, 26, .92);
      color: #ddd2ff;
      font: 700 11px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .06em;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition: border-color .2s ease, color .2s ease, box-shadow .2s ease, opacity .2s ease;
    }
    .ff__bulk:hover:not(:disabled) {
      border-color: rgba(167, 139, 250, .9);
      color: #fff;
      box-shadow: 0 0 16px -6px rgba(139, 92, 246, .95);
    }
    .ff__bulk:focus-visible { outline: 2px solid #A78BFA; outline-offset: 2px; }
    /* Not hidden when it cannot pay: a control that disappears takes the
       explanation with it. Dimmed and inert says "this is here, and you cannot
       afford it yet", which is the actual state — and the HUD's cost line
       right above turns red at the same moment to say why. */
    .ff__bulk:disabled { opacity: .4; cursor: not-allowed; }

    /* ── The haul ───────────────────────────────────────────────────────────
       The Gold face's floater is a number in one colour. This is a name in the
       tier's own colour, taken straight off RUNE_TIERS and handed in as a
       custom property — the rarity ladder has one definition and this is not a
       second one. */
    .ff__loot {
      position: absolute; left: 50%; top: 2px;
      font: 700 12px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .02em;
      white-space: nowrap;
      color: var(--loot-color, #ddd2ff);
      text-shadow: 0 0 10px var(--loot-glow, rgba(139, 92, 246, .8)), 0 1px 3px rgba(0, 0, 0, .9);
      pointer-events: none;
      animation: ffLoot 1.5s cubic-bezier(.2, .8, .3, 1) forwards;
    }
    /* Rare and above. Bigger, and wearing the halo the tier earns. */
    .ff__loot--grand {
      font-size: 15px;
      filter: drop-shadow(0 0 8px var(--loot-glow, rgba(139, 92, 246, .8)));
    }
    .ff__loot-new {
      margin-right: 4px;
      font-size: 9px; letter-spacing: .12em;
      color: #7fd5a3;
      text-shadow: 0 0 8px rgba(127, 213, 163, .8);
    }
    .ff__loot-copies { font-style: normal; opacity: .8; }
    @keyframes ffLoot {
      from { transform: translate(calc(-50% + var(--dx)), var(--dy)) scale(.82); opacity: 0; }
      18%  { opacity: 1; }
      70%  { opacity: 1; }
      to   { transform: translate(calc(-50% + var(--dx)), calc(var(--dy) - 62px)) scale(1.06); opacity: 0; }
    }

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
      position: absolute; bottom: calc(100% + var(--ff-controls-h) + 18px); right: 0;
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
      position: absolute; bottom: calc(100% + var(--ff-controls-h) + 14px); right: 0;
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
    /* What the anvil charges, in the same row style as the rate above it.
       Turns red the moment the purse cannot cover one strike — the x10 button
       goes inert at the same instant, and this is the line that says why. */
    .ff__hud-cost { font-size: 11px; color: #ddd2ff; }
    .ff__hud-cost--broke { color: #ff8fa3; }
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
    /* "FORGE x5" rather than "x5" while the anvil is up: the number means a
       different thing on each face, and the counter is the only place it is
       said. Set a size down and spaced out so the digits still read as the
       loud half. */
    .ff__combo-word {
      margin-right: 4px;
      font-size: 10px; font-weight: 700; letter-spacing: .14em;
      opacity: .85;
    }

    /* Re-triggered per strike from the component, so the number punches on each
       hit rather than sitting still while it climbs. */
    @keyframes ffComboBeat {
      from { transform: translateY(-50%) scale(1.5); }
      to   { transform: translateY(-50%) scale(1); }
    }

    /* ── Combo: the shout ───────────────────────────────────────────────────── */
    .ff__shout {
      position: absolute; bottom: calc(100% + var(--ff-controls-h) + 12px); right: 0;
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

    /* ── Refused ────────────────────────────────────────────────────────────
       Not enough Gold for a strike. A shake and a red wash on the ember, for
       four tenths of a second: the anvil is the only thing on this button that
       can be told no, and silence would read as a dropped click.

       Placed last of the five button animations on purpose. .ff--auto,
       .ff--quake, .ff--shake and .ff--swell all animate transform on the same
       element at the same weight, so the winner is whichever rule is written
       last — and .ff--auto fires once a second for anybody who owns an
       automaton, which is exactly the visitor most likely to be striking an
       anvil they cannot afford. Written above them, the refusal would have
       been swallowed by a decoration.

       The wash goes on .ff__side, not on .ff__face: .ff__face carries
       preserve-3d, and a filter on an element forces it into a flattened
       group — for those four tenths of a second the card would have shown both
       of its faces at once. Not on .ff__core either, which runs ffBreathe and
       animates filter itself; an animation outranks a plain declaration for the
       property it animates, and a second animation on the same property would
       have replaced the breathing rather than tinting it. The sides animate
       nothing, so they are the one layer in the stack that is free. */
    .ff--broke .ff__btn { animation: ffBrokeShake .42s cubic-bezier(.36, .07, .19, .97); }
    @keyframes ffBrokeShake {
      0%, 100% { transform: translateX(0); }
      15% { transform: translateX(-6px); }
      32% { transform: translateX(6px); }
      50% { transform: translateX(-4px); }
      68% { transform: translateX(4px); }
      85% { transform: translateX(-2px); }
    }
    .ff--broke .ff__side { animation: ffBrokeFlash .42s ease-out; }
    @keyframes ffBrokeFlash {
      0%   { filter: none; }
      22%  { filter: brightness(1.1) sepia(1) saturate(7) hue-rotate(-38deg); }
      100% { filter: none; }
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
    /* The haul still names the rune, in its colour; it stops travelling.
       Held longer than the Gold floater's second, because a rune name is
       something to read rather than a number to glance at. */
    .ff--still .ff__loot { animation: ffShoutStill 1.6s linear forwards; }


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

      /* The controls row gets its 44px targets here rather than everywhere:
         a pointer can hit a 28px pill and a thumb cannot, and padding the
         switch to 44px on a desktop would leave a visible dead zone around a
         control that already reads as the right size. */
      .ff { --ff-controls-h: 48px; }
      /* Centred rather than right-aligned, because the flame itself is centred
         from this breakpoint down — right: 0 would hang the row off the left
         of a button that is no longer in the corner. */
      .ff:not(.ff--inline) .ff__controls {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
      .ff__mode { padding: 10px 8px; }
      .ff__bulk { min-height: 44px; padding: 5px 14px; font-size: 12px; }
      /* A name at 12px beside an 80px ember is unreadable at arm's length. */
      .ff__loot { font-size: 13px; }
      .ff__loot--grand { font-size: 16px; }
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

      /* ── The anvil under reduced motion ─────────────────────────────────
         The switch still switches and the anvil still strikes; what goes is
         the half-second of rotation, the travel on the haul, and the shake on
         a refusal. Each one keeps its meaning in a static form: the face
         swaps, the rune name appears and fades where it lands, and the red
         wash still says the purse is empty.

         The two rules that name a keyframes — the haul's fade and the
         refusal's wash — live outside this block, with ffFadeOnly. A media
         query is the one place Angular does not rewrite an animation
         shorthand to match its scoped @keyframes, and a bare name in here
         resolves to nothing at all, silently. */
      .ff__face { transition: none; }
      /* Only the shake is cancelled. The red wash stays: it is the whole
         message, it is 420ms, and it does not move. Its rule lives outside
         this block already, so nothing here has to name it. */
      .ff--broke .ff__btn { animation: none; }
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
  private readonly modes = inject(ForgeModeService);
  private readonly runes = inject(RuneForgeService);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly forgeScene = inject(ForgeSceneService);
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

  // ── The second face ────────────────────────────────────────────────────────

  /** Which face is up. Mirrored off the service so the template can read it. */
  mode: ForgeMode = 'gold';
  /** Runes rising off the anvil, newest last. */
  loot: LootDrop[] = [];
  /** Held for the length of the refusal shake after a strike nobody could pay for. */
  broke = false;
  private brokeSeq = 0;

  /**
   * Consecutive anvil strikes, and when the last one landed.
   *
   * Counted here rather than through `ComboService`, and that is deliberate.
   * The combo ladder counts *paid Gold strikes*, which the economy's 500ms
   * cooldown caps at two a second — every tier threshold, every achievement
   * and the persisted high-water mark are shaped by that ceiling. The anvil
   * has no cooldown and has a x10 button, so feeding it into that service
   * would let one tap add ten to a lifetime record the whole ladder assumes
   * was earned two strikes a second. The counter on screen is the same
   * counter; the record behind it is not this one's to write.
   */
  private forgeStreak = 0;
  private forgeStreakAt = 0;
  private forgeDecay: ReturnType<typeof setTimeout> | null = null;

  /** How long a gap ends an anvil run. Matches the Gold combo's own fuse. */
  private static readonly FORGE_STREAK_MS = 2_000;

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

    // The face, and the ledger behind it. `init()` on both is idempotent and
    // browser-only; the rune ledger is hydrated here rather than on the first
    // anvil strike so that the first strike is not the one paying for the read.
    this.modes.init();
    this.runes.init();
    this.subs.add(this.modes.mode$.subscribe(m => {
      this.mode = m;
      this.cdr.markForCheck();
    }));

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
    if (this.forgeDecay !== null) clearTimeout(this.forgeDecay);
    this.subs.unsubscribe();
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  get gold(): string { return formatCurrency(this.snap.gold); }
  get essence(): string { return formatCurrency(this.snap.essence); }
  get rate(): string { return formatCompact(this.snap.perSecond); }
  get autoRate(): string { return formatRate(this.snap.autoPerSecond); }

  get label(): string {
    if (this.anvil) {
      // The one number that decides whether a press does anything, said first.
      const afford = this.canForge
        ? `Strike for ${formatCurrency(STRIKE_COST)} Gold to forge a rune.`
        : `Not enough Gold to strike — one strike costs ${formatCurrency(STRIKE_COST)}.`;
      return `The Forge Flame, anvil mode. ${formatCurrency(this.snap.gold)} Gold. `
        + `${afford} Press and hold to open the Rune Forge.`;
    }

    const auto = this.snap.autoPerSecond > 0
      ? ` ${this.autoRate} automatic strikes a second.`
      : '';
    // The HUD is aria-hidden, so its two links are invisible to a screen
    // reader. The Rune Forge is named here instead — it is the one destination
    // a visitor cannot otherwise discover from this control.
    return `The Forge Flame. ${formatCurrency(this.snap.gold)} Gold, earning ${this.rate} a second. `
      + `Strike for ${this.snap.perClick} Gold.${auto} Press and hold to open the Rune Forge.`;
  }

  // ── The switch ─────────────────────────────────────────────────────────────

  /** True while the anvil is up. Read by half the template. */
  get anvil(): boolean { return this.mode === 'anvil'; }

  /** What one anvil strike costs, formatted. Flat — the anvil does not scale. */
  get strikeCost(): string { return formatCurrency(STRIKE_COST); }

  /** Whether the purse covers a single strike. Drives the x10 and the HUD line. */
  get canForge(): boolean { return this.snap.gold >= STRIKE_COST; }

  get modeLabel(): string {
    return this.anvil
      ? 'Anvil mode. Switch back to Gold, where a click earns Gold.'
      : 'Gold mode. Switch to Anvil, where a click spends Gold to forge a rune.';
  }

  get bulkLabel(): string {
    return this.canForge
      ? `Forge ten runes for ${formatCurrency(STRIKE_COST * FORGE_BULK)} Gold.`
      : 'Not enough Gold to forge.';
  }

  /**
   * Flip the face.
   *
   * The run in progress ends with the face that earned it: a Gold combo is a
   * rhythm of Gold strikes and an anvil streak is a rhythm of rune strikes, and
   * carrying either across the switch would let somebody bank a x50 on one face
   * by warming up on the other. The Gold combo is the service's to end, and it
   * ends the same way it always does — on the next two seconds of silence.
   */
  toggleMode(): void {
    const next = this.modes.toggle();
    this.endForgeStreak();
    // The Gold face's coin, both ways. It is the only sound in this component
    // that means "something changed" rather than "a strike landed".
    this.audio.coin();
    this.buzz();
    this.announcement = next === 'anvil'
      ? `Anvil mode. A strike now costs ${formatCurrency(STRIKE_COST)} Gold and forges a rune.`
      : 'Gold mode. A strike now earns Gold.';
    this.cdr.markForCheck();
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
    void this.router.navigateByUrl('/forge/runes');
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

  /**
   * Send a shockwave through the WebGL forge from wherever the flame is.
   *
   * The strike handlers do not all carry an event — `strike()` is reached from
   * a click, a touch, the x10 bulk button and the combo path — so the origin is
   * taken from the button's own rect rather than from a pointer. That is also
   * the more honest answer: the energy comes off the flame, not off the finger.
   *
   * A no-op when WebGL never happened, which is what lets this be called
   * unconditionally without the flame knowing anything about the scene.
   */
  private lastRippleAt = 0;

  private rippleTheForge(strength = 1): void {
    if (!this.isBrowser || !this.forgeScene.active) return;
    // Throttled, because the combo ladder rewards 9,999 uninterrupted strikes
    // and a ripple per strike at that rate is a strobe, not a shockwave. The
    // shader only tracks three at once anyway.
    const now = Date.now();
    if (now - this.lastRippleAt < 140) return;
    this.lastRippleAt = now;
    const btn = this.host.nativeElement.querySelector('.ff__btn');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    this.forgeScene.ripple(r.left + r.width / 2, r.top + r.height / 2, strength);
  }

  /** The strike itself, once a gesture has been judged to be one. */
  private strike(): void {
    this.rippleTheForge();
    // The anvil is a different ledger, a different payout and a different
    // failure mode, so it forks here rather than inside the Gold path. Nothing
    // below this line runs for it: no idle XP (the rune ledger awards its own,
    // and paying both would make the anvil the cheapest XP on the site), no
    // economy strike, and no ComboService — see the note on `forgeStreak`.
    if (this.anvil) { this.anvilStrike(1); return; }

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

  // ── The anvil ──────────────────────────────────────────────────────────────

  /** The x10 button. */
  onBulk(): void {
    this.buzz();
    this.anvilStrike(FORGE_BULK);
  }

  /**
   * Strike the anvil up to `count` times and land whatever came off it.
   *
   * Run straight through rather than chunked across frames the way the Rune
   * Forge page runs its thousand: a strike measures 0.27ms on an empty bag and
   * 1.18ms once the inventory cap starts evicting, so ten of them is at worst
   * 12ms — inside a single frame, with nothing to show a progress bar for. The
   * page chunks because it offers x1000; this offers x10 precisely so it does
   * not have to.
   *
   * The loop breaks on the first refusal rather than pre-checking the purse,
   * because the ledger is the only thing that knows: `RuneForgeService.strike()`
   * spends and rolls in one step, and a x10 begun with nine strikes' worth of
   * Gold should bank nine runes, not none.
   */
  private anvilStrike(count: number): void {
    if (!this.isBrowser) return;

    const finds: RuneFind[] = [];
    for (let i = 0; i < count; i++) {
      const find = this.runes.strike();
      if (!find) break;
      finds.push(find);
    }

    if (!finds.length) { this.deny(); return; }
    this.landHaul(finds);
  }

  /** Name every rune that landed, sound the best one, and pay the streak. */
  private landHaul(finds: RuneFind[]): void {
    const best = finds.reduce((acc, f) =>
      RUNE_TIER_ORDER.indexOf(f.rune.tier) > RUNE_TIER_ORDER.indexOf(acc.rune.tier) ? f : acc, finds[0]);
    const bestTier = tierOf(best.rune.tier);
    const grand = RUNE_TIER_ORDER.indexOf(best.rune.tier) >= RUNE_TIER_ORDER.indexOf(FORGE_FLASH_TIER);

    finds.forEach((find, i) => this.pushLoot(find, i));
    this.bumpForgeStreak(finds.length);

    // One sound for the run, pitched by the best thing in it. Ten chimes
    // inside one frame is a click, not a chord.
    if (best.rune.tier === 'singular') this.audio.voidRumble();
    else this.audio.runeReveal(bestTier.semitones, isHeavyTier(best.rune.tier));

    this.sparkBurst(grand ? 18 : 6);
    // Rare and above take the screen. `paint` is already the one place that
    // checks reduced motion, so this needs no guard of its own.
    if (grand) this.paint('flash', 520);

    const led = finds.length === 1
      ? `${best.rune.name}.`
      : `${finds.length} runes. Best: ${best.rune.name}.`;
    this.announcement = `${led} ${tierOf(best.rune.tier).label}. `
      + `${formatCurrency(this.snap.gold)} Gold left.`;

    this.cdr.markForCheck();
  }

  /**
   * The anvil said no.
   *
   * Every path into this is the same one — the purse could not cover a single
   * strike — so there is one response: shake, wash red, and say so out loud.
   * Guarded by a token rather than a boolean so a visitor mashing an anvil they
   * cannot afford re-triggers the animation on each press instead of holding
   * one class that never restarts.
   */
  private deny(): void {
    this.endForgeStreak();
    this.audio.coin();
    this.buzz();
    this.announcement = `Not enough Gold. One strike costs ${formatCurrency(STRIKE_COST)}.`;

    const token = ++this.brokeSeq;
    // Dropped for a frame first: re-adding a class that is already on the
    // element does not restart its animation, and a second refused press would
    // have looked like a dropped click — the exact thing this is here to deny.
    this.broke = false;
    this.cdr.markForCheck();
    this.after(() => {
      if (this.brokeSeq !== token) return;
      this.broke = true;
      this.cdr.markForCheck();
      this.after(() => {
        if (this.brokeSeq !== token) return;
        this.broke = false;
        this.cdr.markForCheck();
      }, 440);
    }, 20);
  }

  /** One rune name, staggered up the stack so a x10 reads as ten things. */
  private pushLoot(find: RuneFind, index: number): void {
    const tier = tierOf(find.rune.tier);
    const key = this.seq++;
    this.loot = [...this.loot, {
      key,
      name: find.rune.name,
      color: tier.color,
      glow: tier.glow,
      grand: RUNE_TIER_ORDER.indexOf(find.rune.tier) >= RUNE_TIER_ORDER.indexOf(FORGE_FLASH_TIER),
      isNew: find.isNew,
      copies: find.copies ?? 1,
      // Half the Gold floater's scatter: these are words, not glyphs, and a
      // wide spread on a 375px viewport walks them off the edge.
      dx: Math.round((Math.random() - 0.5) * 18),
      // Upward, so the whole haul is on screen and reads as one rising column.
      // 14px against a 12px face: tight enough that ten drops clear the top of
      // a phone's flame by 126px rather than 190, loose enough to read as ten.
      dy: index * -14,
    }];
    this.after(() => {
      this.loot = this.loot.filter(l => l.key !== key);
      this.cdr.markForCheck();
    }, 1_560);
  }

  // ── The anvil streak ───────────────────────────────────────────────────────

  private bumpForgeStreak(by: number): void {
    const now = Date.now();
    if (now - this.forgeStreakAt > ForgeFlameComponent.FORGE_STREAK_MS) this.forgeStreak = 0;
    this.forgeStreak += by;
    this.forgeStreakAt = now;

    if (this.forgeDecay !== null) clearTimeout(this.forgeDecay);
    this.zone.runOutsideAngular(() => {
      this.forgeDecay = setTimeout(() => {
        this.zone.run(() => {
          this.forgeDecay = null;
          this.forgeStreak = 0;
          this.cdr.markForCheck();
        });
      }, ForgeFlameComponent.FORGE_STREAK_MS);
    });
  }

  /** End the run now: the face changed, or the anvil refused. */
  private endForgeStreak(): void {
    if (this.forgeDecay !== null) clearTimeout(this.forgeDecay);
    this.forgeDecay = null;
    this.forgeStreak = 0;
    this.forgeStreakAt = 0;
  }

  // ───────────────────────────────────────────────────────────────────────────

  /** The colour the counter is wearing: the held tier's, or purple before one.
   *  The anvil's streak has no tier ladder behind it, so it stays violet. */
  get comboTone(): ComboTone {
    if (this.anvil) return 'purple';
    return this.combo.tier?.tone ?? 'purple';
  }

  /**
   * The counter as a one-or-zero-length list, so `@for`'s tracking does the
   * animation restart for us. Empty below x2, which hides it entirely.
   */
  get comboBadge(): number[] {
    const count = this.anvil ? this.forgeStreak : this.combo.count;
    return count > 1 ? [count] : [];
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
