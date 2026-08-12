/**
 * pro.component.ts — the /pro Pro Pack sales page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BEFORE EDITING THE CHECKOUT
 * ─────────────────────────────────────────────────────────────────────────────
 * `LEMONSQUEEZY.checkoutUrl` is empty until the owner creates the product. The
 * page detects that and renders a waitlist CTA instead of a broken buy button —
 * see `checkoutReady`. Everything else on the page is live either way, because
 * a sales page that cannot be read until payments work is a sales page that
 * teaches you nothing about whether anyone wants the thing.
 *
 * OWNER SETUP — four steps, ~10 minutes:
 *   1. Create a store at https://lemonsqueezy.com (they handle VAT/sales tax,
 *      receipts and refunds, which is the entire reason to use them over Stripe
 *      directly for a one-off digital product).
 *   2. New product → "The Godforge Pro Pack", one-time payment, $9 USD,
 *      digital / no delivery (the entitlement is granted client-side).
 *   3. Share → copy the checkout URL. It looks like
 *      https://<store>.lemonsqueezy.com/buy/<uuid>
 *   4. Paste it into LEMONSQUEEZY.checkoutUrl below and ship.
 *
 * The redirect-back URL to set in LemonSqueezy's product settings is:
 *   https://xsantcastx.com/pro?purchase=success
 * `ngOnInit` reads that param and calls `ProService.activatePro()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE SUCCESS PARAM IS AND IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * `?purchase=success` is a *hint*, not proof of payment — anyone can type it.
 * That is knowingly accepted: see the trust model documented at the top of
 * ProService. If Pro ever gates something expensive, this is the line that has
 * to become a licence-key check against LemonSqueezy's API.
 */
import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ProService,
  PRO_GOLD_BONUS,
  PRO_ESSENCE_BONUS,
  PRO_XP_MULTIPLIER,
} from '../shared/pro/pro.service';

/** LemonSqueezy product configuration. Empty checkoutUrl → waitlist mode. */
const LEMONSQUEEZY = {
  /** Paste the checkout URL here to go live. See the header comment. */
  checkoutUrl: '',
  /** Displayed price. Keep in sync with the LemonSqueezy product. */
  priceUsd: 9,
} as const;

interface ProFeature {
  icon: string;
  title: string;
  body: string;
  /** Marks the two features that do the actual selling. */
  headline?: boolean;
}

interface ProFaq {
  q: string;
  a: string;
}

@Component({
  selector: 'app-pro',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pro.component.html',
  styleUrls: ['./pro.component.css'],
})
export class ProComponent implements OnInit, OnDestroy {
  readonly priceUsd = LEMONSQUEEZY.priceUsd;
  readonly checkoutUrl = LEMONSQUEEZY.checkoutUrl;
  /** False until the owner pastes a real checkout URL. */
  readonly checkoutReady = LEMONSQUEEZY.checkoutUrl.trim().length > 0;

  readonly goldBonus = PRO_GOLD_BONUS;
  readonly essenceBonus = PRO_ESSENCE_BONUS;
  readonly xpMultiplier = PRO_XP_MULTIPLIER;

  /** True once this browser holds Pro — flips the hero into its owned state. */
  isPro = false;
  /** True for the visit that completed a purchase, so we can celebrate once. */
  justPurchased = false;

  private sub?: Subscription;

  readonly features: ProFeature[] = [
    {
      icon: '🚫',
      title: 'Every ad, gone',
      body: 'No sponsor cards, no network scripts, nothing loaded from a third party. The tools, and nothing else, on every page.',
      headline: true,
    },
    {
      icon: '⚡',
      title: `${PRO_XP_MULTIPLIER}× XP, permanently`,
      body: 'Every award doubled — tools, quests, streaks, discoveries. It stacks on top of your enchantments and artifacts rather than replacing them.',
      headline: true,
    },
    {
      icon: '🪙',
      title: `${PRO_GOLD_BONUS} Gold on arrival`,
      body: 'Enough to walk straight past the early upgrade grind and buy something that matters on day one.',
    },
    {
      icon: '🌑',
      title: `${PRO_ESSENCE_BONUS} Eclipse Essence`,
      body: 'The currency you normally only earn from mythic discoveries and rank-ups. Spend it on permanents.',
    },
    {
      icon: '🏷️',
      title: 'The "Pro" title prefix',
      body: 'Sits before your rank everywhere it is shown. Not purchasable with Gold at any price.',
    },
    {
      icon: '📊',
      title: 'Golden XP bar',
      body: 'A gold-sheen progression bar with a slow sweep. The only XP bar skin that moves.',
    },
    {
      icon: '🖼️',
      title: 'Prismatic achievement frame',
      body: 'Borders every card you have earned in the Codex, in shifting prismatic light.',
    },
    {
      icon: '🔑',
      title: 'Early access to new tools',
      body: 'New tools unlock for Pro holders first, before they reach the public registry.',
    },
    {
      icon: '🎖️',
      title: '"Pro Convergent" rank badge',
      body: 'A permanent mark on your rank chip. It says you were here early enough to matter.',
    },
  ];

  readonly faqs: ProFaq[] = [
    {
      q: 'Is this a subscription?',
      a: 'No. It is one payment of $' + LEMONSQUEEZY.priceUsd + ', once, forever. There is no renewal, no card on file, and no way for this to charge you a second time.',
    },
    {
      q: 'What happens to the free tools?',
      a: 'Nothing. All 123+ tools stay free, unlimited and without an account, exactly as they are now. Pro removes ads and adds cosmetics and progression — it does not put a wall in front of anything that works today.',
    },
    {
      q: 'Can I get a refund?',
      a: 'Yes — email xsantcastx@xsantcastx.com within 30 days and you get your money back, no reason needed. LemonSqueezy processes it and you keep whatever Gold you already spent.',
    },
    {
      q: 'Do I need an account?',
      a: 'No. Pro is stored in this browser, the same way your progression already is. If you clear your site data or switch device, email the address on your receipt and it will be restored.',
    },
    {
      q: 'Who handles the payment?',
      a: 'LemonSqueezy — they are the merchant of record, so they handle the card, the sales tax and the receipt. This site never sees your card details.',
    },
    {
      q: 'Why so cheap?',
      a: 'Because the tools are free and always will be, and Pro is closer to a tip jar with rewards attached than to a product tier. $' + LEMONSQUEEZY.priceUsd + ' once, from enough people, pays the hosting bill.',
    },
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private pro: ProService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.sub = this.pro.pro$.subscribe(v => (this.isPro = v));

    if (!isPlatformBrowser(this.platformId)) return;

    // LemonSqueezy redirect lands here. `activatePro` is idempotent, so a
    // bookmarked or refreshed success URL grants the bundle exactly once.
    const param = this.route.snapshot.queryParamMap.get('purchase');
    if (param !== 'success') return;

    this.justPurchased = this.pro.activatePro(
      this.route.snapshot.queryParamMap.get('order_id'),
    );

    // Strip the params so a refresh does not re-run this and so the celebratory
    // state does not survive a share of the URL.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
