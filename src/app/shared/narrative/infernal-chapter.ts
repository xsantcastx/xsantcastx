/**
 * infernal-chapter.ts — approved Infernal opening copy.
 *
 * Source: docs/03-lore-and-design/eclipse-realms-five-realm-narrative-bible-proposal.md
 * §3 Infernal — The Price of a Seam (shipped as PR3 / C8 player text).
 * Presentation only. Persistence lives in chapter.gateway.ts.
 */
import type { InfernalSeamChoice } from './chapter.model';
import { BASALT_SEAMWORKS_HREF } from './chapter.model';

export type InfernalChapterStep = 'enter' | 'meet' | 'inspect' | 'choose' | 'consequence';

export interface InfernalEvidence {
  id: string;
  titleKey: string;
  bodyKey: string;
}

export interface InfernalChoiceDef {
  id: InfernalSeamChoice;
  titleKey: string;
  bodyKey: string;
  consequenceKey: string;
}

export const INFERNAL_CHAPTER_ID = 'infernal';
export const INFERNAL_WITNESS_RUNE = 'Ash';

export const INFERNAL_EVIDENCE: readonly InfernalEvidence[] = [
  {
    id: 'fracture',
    titleKey: 'infernal.evidence.fracture.title',
    bodyKey: 'infernal.evidence.fracture.body',
  },
  {
    id: 'ledger',
    titleKey: 'infernal.evidence.ledger.title',
    bodyKey: 'infernal.evidence.ledger.body',
  },
  {
    id: 'brace',
    titleKey: 'infernal.evidence.brace.title',
    bodyKey: 'infernal.evidence.brace.body',
  },
];

export const INFERNAL_CHOICES: readonly InfernalChoiceDef[] = [
  {
    id: 'central',
    titleKey: 'infernal.choice.central.title',
    bodyKey: 'infernal.choice.central.body',
    consequenceKey: 'infernal.choice.central.consequence',
  },
  {
    id: 'distributed',
    titleKey: 'infernal.choice.distributed.title',
    bodyKey: 'infernal.choice.distributed.body',
    consequenceKey: 'infernal.choice.distributed.consequence',
  },
];

export function infernalChoiceById(id: string | null | undefined): InfernalChoiceDef | null {
  return INFERNAL_CHOICES.find(row => row.id === id) ?? null;
}

export function infernalNextHref(): string {
  return BASALT_SEAMWORKS_HREF;
}
