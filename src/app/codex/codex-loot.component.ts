/**
 * codex-loot.component.ts — the Codex entry for loot and combat
 * (docs/design/loot-and-combat.md): the rarity ladder as it shines on the
 * ground, the nine auras and which Socket Word or named thing carries each
 * (a word not yet found stays a clue), and the three passes.
 *
 * Deferred from the Collection tab, so its words (loot.i18n.ts) and the loot
 * service are their own lazy chunk.
 */
import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../translation.service';
import { LOOT_I18N } from '../shared/loot/loot.i18n';
import { LOOT_TIER_ORDER, type LootTier } from '../shared/loot/loot-tiers';
import { AURA_IDS, AURAS, type AuraId } from '../shared/loot/auras';
import { DIFFICULTIES, DIFFICULTY_TIERS, type DifficultyTier } from '../shared/loot/difficulty.model';
import { SOCKET_WORDS, matchSocketWord } from '../shared/enchanting/socket-words';
import { UNIQUE_ITEMS } from '../shared/rpg/unique-items';
import { RUNE_TIERS } from '../shared/rune-forge/rune.model';
import { LootService } from '../shared/loot/loot.service';
import { InventoryService } from '../shared/rpg/inventory.service';

interface AuraRow { id: AuraId; color: string; sources: string[] }

@Component({
  selector: 'app-codex-loot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cx-block loot" data-codex="loot">
      <h3 class="cx-block__title">{{ t('loot.codex.title') }}</h3>
      <p class="cx-block__sub">{{ t('loot.codex.sub') }}</p>
      <h4 class="loot__h">{{ t('loot.codex.ladder') }}</h4>
      <ul class="loot__list">
        @for (tier of ladder; track tier) {
          <li class="loot__row" [attr.data-rung]="tier"><i class="loot__beam" [style.background]="color(tier)"></i><span>{{ t('loot.rarity.' + tier) }}</span></li>
        }
      </ul>
      <h4 class="loot__h">{{ t('loot.codex.auras') }}</h4>
      <ul class="loot__list">
        @for (a of auras; track a.id) {
          <li class="loot__row" [attr.data-aura-row]="a.id"><i class="loot__beam" [style.background]="a.color"></i>
            <span><b>{{ t('loot.aura.' + a.id) }}</b> — {{ a.sources.join(', ') }}</span></li>
        }
      </ul>
      <h4 class="loot__h">{{ t('loot.codex.tiers') }}</h4>
      <ul class="loot__list">
        @for (tier of tiers; track tier) {
          <li class="loot__row" [attr.data-tier-row]="tier"><i class="loot__beam" [style.background]="tierColor(tier)"></i>
            <span><b>{{ t('loot.tier.' + tier) }}</b> — {{ t('loot.tierBlurb.' + tier) }}</span></li>
        }
      </ul>
      <p class="loot__now">{{ t('loot.codex.current', { tier: t('loot.tier.' + current) }) }}</p>
    </div>
  `,
  styles: [`
    .loot { margin-top: 1.5rem; }
    .loot__h { margin: .8rem 0 .3rem; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: var(--cx-text); }
    .loot__list { list-style: none; margin: 0; padding: 0; display: grid; gap: .3rem; }
    .loot__row { display: grid; grid-template-columns: 10px 1fr; gap: .6rem; align-items: center; padding: .35rem .6rem; border: 1px solid var(--cx-line); border-radius: 10px; font-size: .82rem; color: var(--cx-dim); }
    .loot__row b { color: var(--cx-text); }
    .loot__beam { display: block; width: 6px; height: 22px; image-rendering: pixelated; }
    .loot__now { margin: .6rem 0 0; font-size: .82rem; color: var(--cx-text); }
  `],
})
export class CodexLootComponent implements OnInit {
  private readonly i18n = inject(TranslationService);
  private readonly loot = inject(LootService);
  private readonly inventory = inject(InventoryService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly ladder: readonly LootTier[] = LOOT_TIER_ORDER;
  readonly tiers: readonly DifficultyTier[] = DIFFICULTY_TIERS;
  auras: AuraRow[] = this.rows(new Set());
  current: DifficultyTier = 'normal';

  constructor() { this.i18n.register(LOOT_I18N); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.current = this.loot.state.tier;
    this.auras = this.rows(this.found());
  }

  /** Socket Words seated in something this Keeper owns (the Secrets wall's meaning of found); the rest stay a clue. */
  private found(): Set<string> {
    const ids = new Set<string>();
    for (const item of this.inventory.snapshot.items) { const w = matchSocketWord(item); if (w) ids.add(w.id); }
    return ids;
  }

  /** Every aura (AURA_IDS) with what grants it: a found word by name, an unfound one as a clue, a unique by name. */
  private rows(found: Set<string>): AuraRow[] {
    return AURA_IDS.map(id => ({
      id, color: AURAS[id].color,
      sources: [
        ...SOCKET_WORDS.filter(w => w.aura === id).map(w => (found.has(w.id) ? w.name : `${this.t('loot.codex.unknown')} (${w.clue})`)),
        ...UNIQUE_ITEMS.filter(u => u.aura === id).map(u => u.name),
      ],
    }));
  }

  color(tier: LootTier): string { return RUNE_TIERS[tier].color; }
  tierColor(tier: DifficultyTier): string { return DIFFICULTIES[tier].color; }
  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
}
