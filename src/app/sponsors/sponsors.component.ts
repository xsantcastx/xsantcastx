import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TOOLS_REGISTRY } from '../tools/tools-registry';
import { SponsorPlacement } from '../shared/sponsor-slot/sponsor.service';

/**
 * sponsors.component.ts — the /sponsors advertiser landing page.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE EDITING THE NUMBERS
 * ─────────────────────────────────────────────────────────────────────────
 * Everything an advertiser could make a purchasing decision on lives in the
 * MEDIA_KIT constant below, and every audience/pricing field defaults to
 * `null`.
 *
 * A null field renders an honest fallback ("Request current numbers") rather
 * than a made-up figure. Publishing invented traffic or pricing to people who
 * are deciding whether to pay is misrepresentation, so the page is built to
 * be correct while empty and only quotes a number once a real one is set.
 *
 * To go live with real figures: open the analytics property, copy the last
 * full month, fill the fields in, and ship it as a normal commit. The
 * `sourceNote` string is shown under the stat row so the number is always
 * attributable.
 *
 * Counts that ARE derived from the codebase (tool count, category count,
 * placement count) are computed from TOOLS_REGISTRY at build time and are
 * always safe to display.
 */

/** A single headline audience stat. `value: null` → "on request". */
interface AudienceStat {
  /** Display label under the number */
  label: string;
  /** The real measured number, or null until the owner fills it in */
  value: number | null;
  /** Suffix appended to a non-null value (e.g. '+', '%') */
  suffix?: string;
  /** Short clarifier shown beneath the label */
  hint: string;
  /** Star palette color (CLAUDE.md §2 — do not invent new colors) */
  color: string;
}

/** A bookable package. `priceUsd: null` → "Contact for pricing". */
interface SponsorTier {
  id: string;
  name: string;
  /** Monthly price in USD, or null until pricing is set */
  priceUsd: number | null;
  blurb: string;
  features: string[];
  color: string;
  glow: string;
  /** Marks the tier rendered with the emphasised border */
  featured?: boolean;
}

/** A placement an advertiser can buy, mirrored from SponsorPlacement. */
interface PlacementOption {
  placement: SponsorPlacement;
  name: string;
  where: string;
  /** Registry categories this placement covers */
  categories: string[];
  color: string;
  /** Filled in the constructor from TOOLS_REGISTRY */
  toolCount: number;
}

interface FaqItem {
  q: string;
  a: string;
}

/**
 * Owner-configurable media kit. Fill the nulls with real analytics before
 * quoting numbers publicly — see the file header.
 */
const MEDIA_KIT = {
  /**
   * Where the audience figures come from. Shown under the stat row so a
   * prospective sponsor can judge the source. Update it with the figures.
   */
  sourceNote:
    'Traffic figures are shared directly from the analytics dashboard when you get in touch — no inflated public estimates.',
  /** Contact address for booking */
  contactEmail: 'xsantcastx@xsantcastx.com',
  /** Typical turnaround quoted in the contact section. */
  replyWindow: 'same day, usually within a few hours',
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AUDIENCE NUMBERS — READ BEFORE FLIPPING THIS TO TRUE
 * ─────────────────────────────────────────────────────────────────────────────
 * `AUDIENCE_VERIFIED` gates whether the figures in `PENDING_AUDIENCE` below are
 * published on the page. It is false, and it must stay false until the owner
 * has opened the analytics property and confirmed each number against a real
 * reporting window.
 *
 * Why the gate exists rather than just pasting the numbers in:
 * these figures are shown to people deciding whether to send money. Publishing
 * an unconfirmed traffic claim to a prospective advertiser is misrepresentation
 * even when the number turns out to be right, because at the moment of
 * publishing nobody had checked. The rest of this file is built on the same
 * principle — every `value: null` renders "on request" instead of a guess.
 *
 * TO PUBLISH:
 *   1. Open the analytics dashboard and pick a full, closed reporting window.
 *   2. Correct any figure in PENDING_AUDIENCE that does not match it.
 *   3. Set `sourceNote` to name the window, e.g. "Plausible, Jul 2026".
 *   4. Flip AUDIENCE_VERIFIED to true.
 *
 * The values below were supplied by the owner ahead of that check. They are
 * recorded here so the work is not lost, NOT because they have been verified.
 */
const AUDIENCE_VERIFIED = false;

const PENDING_AUDIENCE = {
  dailyActiveUsers: 246,
  dayOneRetentionPct: 50,
} as const;

@Component({
  selector: 'app-sponsors',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sponsors.component.html',
  styleUrls: ['./sponsors.component.css'],
})
export class SponsorsComponent {
  readonly contactEmail = MEDIA_KIT.contactEmail;
  readonly sourceNote = MEDIA_KIT.sourceNote;
  readonly replyWindow = MEDIA_KIT.replyWindow;

  /** Prefilled booking mail link — keeps the first message useful. */
  readonly bookingMailto: string;

  /** Verifiable, derived from the registry rather than asserted. */
  readonly liveToolCount: number;
  readonly categoryCount: number;

  /**
   * Audience stats. Every `value` is null until real analytics are pasted in;
   * the template shows "on request" for those instead of inventing a figure.
   */
  readonly audienceStats: AudienceStat[] = [
    {
      label: 'Monthly visitors',
      value: null,
      suffix: '+',
      hint: 'Shared from the live dashboard on request',
      color: '#A78BFA',
    },
    {
      label: 'Monthly tool sessions',
      value: null,
      suffix: '+',
      hint: 'People actually using a tool, not bouncing',
      color: '#ff6dd7',
    },
    {
      label: 'Newsletter subscribers',
      value: null,
      suffix: '',
      hint: 'Opted in for one new tool a week',
      color: '#a48bff',
    },
    // The two figures below stay null until AUDIENCE_VERIFIED is flipped —
    // see the block comment on that constant.
    {
      label: 'Daily active users',
      value: AUDIENCE_VERIFIED ? PENDING_AUDIENCE.dailyActiveUsers : null,
      suffix: '+',
      hint: 'People who opened a tool that day',
      color: '#4dffe0',
    },
    {
      label: 'Day 1 retention',
      value: AUDIENCE_VERIFIED ? PENDING_AUDIENCE.dayOneRetentionPct : null,
      suffix: '%',
      hint: 'Came back the day after their first visit',
      color: '#7fd5a3',
    },
  ];

  /** Who is on the other side of the screen. These are qualitative claims. */
  readonly audienceProfile = [
    {
      title: 'Front-end & full-stack developers',
      body:
        'They land here mid-task — building a shadow, debugging a regex, formatting a payload. High intent, low patience for anything that gets in the way.',
      color: '#A78BFA',
    },
    {
      title: 'Designers who write CSS',
      body:
        'The gradient, palette and shadow tools pull in the design side of the house — the people who pick the stack for the visual layer.',
      color: '#ff6dd7',
    },
    {
      title: 'Indie hackers & solo builders',
      body:
        'Shipping alone, evaluating tools constantly, and buying without a procurement cycle. They try things the same day they hear about them.',
      color: '#ffc669',
    },
  ];

  /** What makes the slot worth buying — all structural, all verifiable. */
  readonly valueProps = [
    {
      title: 'One sponsor, not an auction',
      body:
        'A category is sold to a single sponsor for the month. Your card is never rotated against another sponsor\'s, and there is no bidding for the position.',
      color: '#A78BFA',
    },
    {
      title: 'Category targeting',
      body:
        'Book the category your product belongs to. A security product runs on the security tools, not next to a colour picker.',
      color: '#a48bff',
    },
    {
      title: 'Native, not an iframe',
      body:
        'Your card is rendered by the site itself, in the site\'s own design system. It loads no third-party script, so there is nothing for an ad blocker to strip.',
      color: '#7fd5a3',
    },
    {
      title: 'Honest disclosure',
      body:
        'Every slot carries a visible "Sponsored" badge and a rel="sponsored" link, per FTC and Google guidance. Good for your SEO and mine.',
      color: '#ffc669',
    },
  ];

  /** Bookable placements, tool counts derived from the registry. */
  readonly placements: PlacementOption[] = [
    {
      placement: 'tool-page:css',
      name: 'CSS & design tools',
      where: 'In-content, below the generator output',
      categories: ['CSS Tools', 'CSS Generators', 'CSS'],
      color: '#A78BFA',
      toolCount: 0,
    },
    {
      placement: 'tool-page:code',
      name: 'Code converters',
      where: 'In-content, below the conversion output',
      categories: ['Code Converters'],
      color: '#5fb6ff',
      toolCount: 0,
    },
    {
      placement: 'tool-page:text',
      name: 'Text & data tools',
      where: 'In-content, below the result panel',
      categories: ['Text & Data'],
      color: '#c48bff',
      toolCount: 0,
    },
    {
      placement: 'tool-page:security',
      name: 'Security tools',
      where: 'In-content, below the generator output',
      categories: ['Security Tools'],
      color: '#a48bff',
      toolCount: 0,
    },
    {
      placement: 'tool-page:productivity',
      name: 'Productivity tools',
      where: 'In-content, below the tool output',
      categories: ['Productivity'],
      color: '#ffc669',
      toolCount: 0,
    },
  ];

  /**
   * Packages. Prices are null on purpose — see the file header. Set
   * `priceUsd` once a rate card exists and the tiers start quoting it.
   */
  readonly tiers: SponsorTier[] = [
    {
      id: 'single',
      name: 'Single category',
      // Unlike the audience figures, this is a decision rather than a
      // measurement: it is the owner's asking price, so publishing it is not a
      // claim about the world that could turn out to be false.
      priceUsd: 200,
      blurb: 'One placement family, one month.',
      features: [
        'Your card on every tool in one category',
        'Logo, headline, one-line pitch and CTA',
        'Your accent colour on the card',
        'Impression + click counts shared monthly',
      ],
      color: '#A78BFA',
      glow: 'rgba(139, 92, 246, 0.6)',
    },
    {
      id: 'network',
      name: 'Whole network',
      // Five categories at the single rate would be $1,000; the bundle is
      // priced at $750 so taking the whole network is the obvious move for
      // anyone considering more than two.
      priceUsd: 750,
      blurb: 'Every category, every wired tool page.',
      features: [
        'All five in-content placement families',
        'First position ahead of any house promo',
        'A mention in the weekly newsletter',
        'Impression + click counts shared monthly',
      ],
      color: '#ff6dd7',
      glow: 'rgba(255, 90, 210, 0.6)',
      featured: true,
    },
    {
      id: 'custom',
      name: 'Something else',
      priceUsd: null,
      blurb: 'A launch, a sponsored tool, a longer term.',
      features: [
        'Multi-month rates',
        'Sponsor a new tool build end to end',
        'Co-branded write-up on the blueprint',
        'Tell me what you have in mind',
      ],
      color: '#a48bff',
      glow: 'rgba(140, 110, 255, 0.6)',
    },
  ];

  readonly faqs: FaqItem[] = [
    {
      q: 'How many sponsors run at once?',
      a: 'One per placement, at most. A category is sold to a single sponsor for the month — your card is not rotated against anyone else\'s.',
    },
    {
      q: 'Is this slot sold through an ad network?',
      a: 'No. This slot is direct-deal only — you email me, we agree a price, and I add your card in a commit. There is no network, no auction and no behavioural targeting involved in it.',
    },
    {
      q: 'What else is on the page alongside my card?',
      a: 'Being straight with you: tool pages also carry a Carbon Ads unit and an affiliate recommendation card, both labelled "Sponsored". Your card is the only slot sold directly and the only one whose category you choose, but it is not the only commercial thing on the page. If exclusivity matters for your campaign, ask — the other units can be turned off for a sponsored category.',
    },
    {
      q: 'What do you track, and what do I get back?',
      a: 'Impressions and clicks, counted first-party with no cookies or cross-site identifiers. You get both numbers at the end of the month.',
    },
    {
      q: 'Will an ad blocker eat it?',
      a: 'Your card is part of the page, rendered by the same code as everything else, and makes no third-party request — so there is nothing for a blocker to intercept.',
    },
    {
      q: 'Is the link followed?',
      a: 'No. Every sponsor CTA ships rel="sponsored noopener noreferrer", which is what Google asks for. Buy the audience, not the link equity.',
    },
    {
      q: 'What do you not accept?',
      a: 'Anything I would not use myself, anything that needs a user to be tricked, and anything that would make a developer mid-task feel sold to. I will say no and mean it.',
    },
    {
      q: 'Can I see the numbers before committing?',
      a: 'Yes — email me and I will share the analytics dashboard figures directly. Nothing on this page is an estimate, which is why the traffic numbers are not printed here.',
    },
    {
      q: 'How do I get started?',
      a: 'Email ' + MEDIA_KIT.contactEmail + ' with your product and the category you want. I will reply with current traffic, availability and a rate.',
    },
  ];

  constructor() {
    // Derive the honest, verifiable counts from the registry.
    const live = TOOLS_REGISTRY.filter(t => t.status === 'live');
    this.liveToolCount = live.length;
    this.categoryCount = new Set(live.map(t => t.category)).size;

    for (const p of this.placements) {
      p.toolCount = live.filter(t => p.categories.includes(t.category)).length;
    }

    const subject = encodeURIComponent('Sponsorship enquiry — xsantcastx.com');
    const body = encodeURIComponent(
      [
        'Product:',
        'Link:',
        'Category I want:',
        'Months:',
        '',
        'Anything else:',
      ].join('\n'),
    );
    this.bookingMailto = `mailto:${MEDIA_KIT.contactEmail}?subject=${subject}&body=${body}`;
  }

  /** Format a stat, falling back to an honest "on request" when unset. */
  formatStat(stat: AudienceStat): string {
    if (stat.value === null) return 'on request';
    return stat.value.toLocaleString('en-US') + (stat.suffix ?? '');
  }

  /** True when no real audience figure has been configured yet. */
  get hasPublishedAudienceNumbers(): boolean {
    return this.audienceStats.some(s => s.value !== null);
  }

  /** Format a tier price, falling back to "Contact for pricing". */
  formatPrice(tier: SponsorTier): string {
    if (tier.priceUsd === null) return 'Contact for pricing';
    return `$${tier.priceUsd.toLocaleString('en-US')}`;
  }

  priceSuffix(tier: SponsorTier): string {
    return tier.priceUsd === null ? '' : '/month';
  }
}
