/**
 * entity-resolver.service.ts — read-only presentation for Quick Inspect.
 *
 * Reads registries and current snapshots only. Does not write Economy,
 * Inventory, cloud-save, or Firestore.
 */
import { Injectable, inject } from '@angular/core';

import { TranslationService } from '../../translation.service';
import {
  ARTIFACTS,
  COSMETICS,
  ENCHANTMENTS,
  formatCompact,
  formatCurrency,
  upgradeById,
} from '../economy/economy.model';
import { FIVE_REALMS, realmHref } from '../narrative/five-realms.narrative';
import { questById } from '../quests/quest.model';
import { RARITIES } from '../rarity/rarity.model';
import { forgeRecipeById } from '../rpg/forge-recipes';
import { BASALT_EDGE_PORTRAIT, isBasaltEdge } from '../rpg/material-catalog';
import { slotAccepts } from '../rpg/item.model';
import { InventoryService } from '../rpg/inventory.service';
import { ITEM_STAT_IS_PERCENT, ITEM_STAT_KEYS, ITEM_STAT_LABELS, rarityLabel } from '../rpg/item.model';
import { RUNES, RUNEWORDS, RUNE_TIERS, tierOf } from '../rune-forge/rune.model';
import {
  type EntityAction,
  type EntityFact,
  type EntityPresentation,
  type EntityRef,
  type EntityResolution,
  type EntityRarity,
} from './entity.model';

export function slugifyThreat(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable({ providedIn: 'root' })
export class EntityResolver {
  private readonly i18n = inject(TranslationService);
  private readonly inventory = inject(InventoryService);

  resolve(ref: EntityRef): EntityResolution {
    try {
      switch (ref.type) {
        case 'market-listing': return this.listing(ref);
        case 'item': return this.item(ref);
        case 'rune': return this.rune(ref);
        case 'runeword': return this.runeword(ref);
        case 'recipe': return this.recipe(ref);
        case 'realm': return this.realm(ref);
        case 'quest': return this.quest(ref);
        case 'creature':
        case 'boss': return this.creature(ref);
        default: return this.missing(ref);
      }
    } catch {
      return {
        state: 'error',
        actions: [],
        retryable: true,
        message: this.t('inspect.error'),
      };
    }
  }

  private t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  private missing(ref: EntityRef, name?: string): EntityResolution {
    return {
      state: 'missing',
      actions: [],
      retryable: false,
      message: this.t('inspect.missing', { name: name ?? ref.id }),
    };
  }

  private ready(
    presentation: EntityPresentation,
    actions: readonly EntityAction[] = [],
  ): EntityResolution {
    return { state: 'ready', presentation, actions, retryable: false };
  }

  private rarityFromEclipse(id: string): EntityRarity | undefined {
    const def = RARITIES[id as keyof typeof RARITIES];
    if (!def) return undefined;
    return { id: def.id, label: def.label, color: def.color, glow: def.glow };
  }

  private listing(ref: EntityRef): EntityResolution {
    const upgrade = upgradeById(ref.id);
    if (upgrade) {
      const cost = 'baseCost' in upgrade ? upgrade.baseCost : 0;
      return this.ready({
        ref,
        name: upgrade.name,
        kindLabel: this.t('inspect.kind.market-listing'),
        accessibleName: this.t('inspect.a11y.named', { name: upgrade.name, kind: this.t('inspect.kind.market-listing') }),
        glyphFallback: upgrade.icon,
        summary: upgrade.effect,
        lore: upgrade.flavour,
        facts: [
          this.moneyFact(this.t('inspect.fact.price'), cost),
          { label: this.t('inspect.fact.effect'), value: upgrade.effect, exactValue: upgrade.effect },
        ],
      });
    }

    const enchant = ENCHANTMENTS.find(entry => entry.id === ref.id);
    if (enchant) {
      return this.ready({
        ref,
        name: enchant.name,
        kindLabel: this.t('inspect.kind.market-listing'),
        accessibleName: this.t('inspect.a11y.named', { name: enchant.name, kind: this.t('inspect.kind.market-listing') }),
        glyphFallback: enchant.icon,
        summary: enchant.effect,
        lore: enchant.flavour,
        facts: [
          this.moneyFact(this.t('inspect.fact.price'), enchant.cost, 'essence'),
          { label: this.t('inspect.fact.duration'), value: `${enchant.hours}h`, exactValue: String(enchant.hours) },
        ],
      });
    }

    const artifact = ARTIFACTS.find(entry => entry.id === ref.id);
    if (artifact) {
      return this.ready({
        ref,
        name: artifact.name,
        kindLabel: this.t('inspect.kind.market-listing'),
        accessibleName: this.t('inspect.a11y.named', { name: artifact.name, kind: this.t('inspect.kind.market-listing') }),
        rarity: this.rarityFromEclipse(artifact.tier),
        glyphFallback: artifact.icon,
        summary: artifact.effect,
        lore: artifact.lore,
        facts: [this.moneyFact(this.t('inspect.fact.price'), artifact.cost, 'essence')],
      });
    }

    const cosmetic = COSMETICS.find(entry => entry.id === ref.id);
    if (cosmetic) {
      return this.ready({
        ref,
        name: cosmetic.name,
        kindLabel: this.t('inspect.kind.market-listing'),
        accessibleName: this.t('inspect.a11y.named', { name: cosmetic.name, kind: this.t('inspect.kind.market-listing') }),
        glyphFallback: cosmetic.icon,
        summary: cosmetic.effect,
        lore: cosmetic.flavour,
        facts: [this.moneyFact(this.t('inspect.fact.price'), cosmetic.cost)],
      });
    }

    return this.missing(ref);
  }

  private item(ref: EntityRef): EntityResolution {
    const item = this.inventory.snapshot.items.find(entry => entry.id === ref.id);
    if (!item) return this.missing(ref);
    const facts: EntityFact[] = [
      { label: this.t('inspect.fact.rarity'), value: rarityLabel(item.rarity), exactValue: rarityLabel(item.rarity) },
      this.locationFact(item),
    ];
    for (const key of ITEM_STAT_KEYS) {
      const raw = item.stats[key];
      if (raw == null) continue;
      const exact = ITEM_STAT_IS_PERCENT[key] ? `${raw}` : String(raw);
      facts.push({
        label: ITEM_STAT_LABELS[key],
        value: ITEM_STAT_IS_PERCENT[key] ? `${raw}%` : String(raw),
        exactValue: exact,
      });
    }
    const level = item.upgradeLevel ?? 0;
    facts.push({
      label: this.t('inspect.fact.temper'),
      value: this.t('inspect.fact.temperValue', { n: level }),
      exactValue: String(level),
    });
    if (!item.soulbound) {
      facts.push(this.moneyFact(this.t('inspect.fact.sellValue'), item.sellValue));
    }
    const tier = RUNE_TIERS[item.rarity];
    const canEquipWeapon = isBasaltEdge(item) && slotAccepts('weapon', item);
    return this.ready({
      ref,
      name: item.name,
      kindLabel: this.t('inspect.kind.item'),
      accessibleName: this.t('inspect.a11y.named', { name: item.name, kind: this.t('inspect.kind.item') }),
      rarity: { id: item.rarity, label: rarityLabel(item.rarity), color: tier.color, glow: tier.glow },
      art: isBasaltEdge(item) ? { src: BASALT_EDGE_PORTRAIT, alt: item.name } : undefined,
      glyphFallback: '◈',
      summary: item.lore ?? item.name,
      lore: item.lore,
      facts,
    }, canEquipWeapon ? [{
      id: 'equip',
      label: item.equipped ? this.t('inspect.action.equipped') : this.t('inspect.action.equip'),
      kind: 'primary',
      enabled: !item.equipped,
      unavailableReason: item.equipped ? this.t('inspect.action.equipped') : undefined,
    }] : []);
  }

  private rune(ref: EntityRef): EntityResolution {
    const rune = RUNES.find(entry => entry.id === ref.id);
    if (!rune) return this.missing(ref);
    const tier = tierOf(rune.tier);
    return this.ready({
      ref,
      name: rune.name,
      kindLabel: this.t('inspect.kind.rune'),
      accessibleName: this.t('inspect.a11y.named', { name: rune.name, kind: this.t('inspect.kind.rune') }),
      rarity: { id: tier.id, label: tier.label, color: tier.color, glow: tier.glow },
      glyphFallback: rune.icon ?? rune.name.slice(0, 1),
      summary: rune.lore,
      lore: rune.lore,
      facts: [
        { label: this.t('inspect.fact.rarity'), value: tier.label, exactValue: tier.label },
        this.moneyFact(this.t('inspect.fact.worth'), rune.forgeCost),
        {
          label: this.t('inspect.fact.drop'),
          value: `${(rune.dropRate * 100).toPrecision(3)}%`,
          exactValue: String(rune.dropRate),
        },
      ],
    });
  }

  private recipe(ref: EntityRef): EntityResolution {
    const equipment = forgeRecipeById(ref.id);
    if (equipment) {
      const recipe = equipment.inputs
        .map(input => `${input.quantity} ${input.name}`)
        .join(' + ');
      return this.ready({
        ref: { type: 'recipe', id: equipment.id },
        name: equipment.name,
        kindLabel: this.t('inspect.kind.recipe'),
        accessibleName: this.t('inspect.a11y.named', {
          name: equipment.name,
          kind: this.t('inspect.kind.recipe'),
        }),
        glyphFallback: '⚔',
        art: equipment.portrait
          ? { src: equipment.portrait, alt: equipment.name }
          : undefined,
        summary: equipment.summary,
        lore: equipment.lore,
        facts: [
          { label: this.t('inspect.fact.recipe'), value: recipe, exactValue: recipe },
          { label: this.t('inspect.fact.slot'), value: this.t('loadout.slot.weapon'), exactValue: equipment.slotId },
          {
            label: this.t('inspect.fact.status'),
            value: equipment.craftable ? this.t('forge.recipe.ready') : this.t('forge.recipe.locked'),
            exactValue: equipment.craftable ? this.t('forge.recipe.ready') : this.t('forge.recipe.locked'),
          },
        ],
      });
    }
    return this.runeword({ ...ref, type: 'recipe' });
  }

  private runeword(ref: EntityRef): EntityResolution {
    const word = RUNEWORDS.find(entry => entry.id === ref.id);
    if (!word) return this.missing(ref);
    const tier = tierOf(word.tier);
    const recipe = word.runes.join(', ');
    return this.ready({
      ref: { type: ref.type, id: word.id },
      name: word.name,
      kindLabel: this.t(ref.type === 'recipe' ? 'inspect.kind.recipe' : 'inspect.kind.runeword'),
      accessibleName: this.t('inspect.a11y.named', {
        name: word.name,
        kind: this.t(ref.type === 'recipe' ? 'inspect.kind.recipe' : 'inspect.kind.runeword'),
      }),
      rarity: { id: tier.id, label: tier.label, color: tier.color, glow: tier.glow },
      glyphFallback: '✦',
      summary: word.effect,
      lore: word.lore,
      facts: [
        { label: this.t('inspect.fact.recipe'), value: recipe, exactValue: recipe },
        { label: this.t('inspect.fact.effect'), value: word.effect, exactValue: word.effect },
      ],
    });
  }

  private realm(ref: EntityRef): EntityResolution {
    const realm = FIVE_REALMS.find(entry => entry.id === ref.id);
    if (!realm) return this.missing(ref);
    return this.ready(
      {
        ref,
        name: realm.name,
        kindLabel: this.t('inspect.kind.realm'),
        accessibleName: this.t('inspect.a11y.named', { name: realm.name, kind: this.t('inspect.kind.realm') }),
        rarity: { id: realm.id, label: realm.name, color: realm.color, glow: realm.glow },
        glyphFallback: realm.name.slice(0, 1),
        summary: realm.function,
        lore: realm.conflict,
        facts: [
          { label: this.t('inspect.fact.faction'), value: realm.faction, exactValue: realm.faction },
          { label: this.t('inspect.fact.landmark'), value: realm.landmark, exactValue: realm.landmark },
          { label: this.t('inspect.fact.hazard'), value: realm.hazard, exactValue: realm.hazard },
        ],
      },
      [{
        id: 'continue-journey',
        label: this.t('inspect.action.dossier'),
        kind: 'link',
        enabled: true,
        href: realmHref(realm.id),
      }],
    );
  }

  private quest(ref: EntityRef): EntityResolution {
    const quest = questById(ref.id);
    if (!quest) return this.missing(ref);
    return this.ready({
      ref,
      name: quest.title,
      kindLabel: this.t('inspect.kind.quest'),
      accessibleName: this.t('inspect.a11y.named', { name: quest.title, kind: this.t('inspect.kind.quest') }),
      rarity: this.rarityFromEclipse(quest.rarity),
      glyphFallback: '⚔',
      summary: quest.description,
      lore: quest.loreText,
      facts: [
        { label: this.t('inspect.fact.type'), value: quest.type, exactValue: quest.type },
        {
          label: this.t('inspect.fact.reward'),
          value: this.t('inspect.fact.xp', { amount: quest.rewards.xp }),
          exactValue: String(quest.rewards.xp),
        },
      ],
    });
  }

  private creature(ref: EntityRef): EntityResolution {
    const match = FIVE_REALMS.find(realm => slugifyThreat(realm.threat) === ref.id);
    if (!match) return this.missing(ref);
    return this.ready({
      ref,
      name: match.threat,
      kindLabel: this.t('inspect.kind.creature'),
      accessibleName: this.t('inspect.a11y.named', { name: match.threat, kind: this.t('inspect.kind.creature') }),
      rarity: { id: match.id, label: match.name, color: match.color, glow: match.glow },
      glyphFallback: '☽',
      summary: match.threatDetail,
      lore: match.threatDetail,
      facts: [
        { label: this.t('inspect.fact.realm'), value: match.name, exactValue: match.name },
        { label: this.t('inspect.fact.landmark'), value: match.landmark, exactValue: match.landmark },
      ],
    }, [{
      id: 'continue-journey',
      label: this.t('inspect.action.dossier'),
      kind: 'link',
      enabled: true,
      href: realmHref(match.id),
    }]);
  }

  private locationFact(item: { equipped: boolean; slot?: string; explorerId?: string }): EntityFact {
    if (item.equipped) {
      return {
        label: this.t('inspect.fact.location'),
        value: this.t('inspect.location.equipped', { slot: item.slot ?? '' }),
        exactValue: item.slot ?? 'equipped',
      };
    }
    if (item.explorerId) {
      return {
        label: this.t('inspect.fact.location'),
        value: this.t('inspect.location.explorer'),
        exactValue: item.explorerId,
      };
    }
    return {
      label: this.t('inspect.fact.location'),
      value: this.t('inspect.location.bag'),
      exactValue: 'bag',
    };
  }

  private moneyFact(label: string, amount: number, currency: 'gold' | 'essence' = 'gold'): EntityPresentation['facts'][number] {
    const exact = `${formatCurrency(amount)} ${currency === 'essence' ? 'Essence' : 'Gold'}`;
    return {
      label,
      value: `${formatCompact(amount)} ${currency === 'essence' ? 'Essence' : 'Gold'}`,
      exactValue: exact,
    };
  }
}
