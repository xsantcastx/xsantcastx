/**
 * infernal-chapter.ts — approved Infernal opening copy.
 *
 * Source: docs/03-lore-and-design/eclipse-realms-five-realm-narrative-bible-proposal.md
 * §3 Infernal — The Price of a Seam (shipped as PR3 / C8 player text).
 * Presentation only. Persistence lives in chapter.gateway.ts.
 */
import type { InfernalSeamChoice } from './chapter.model';
import { BASALT_SEAMWORKS_HREF } from './chapter.model';

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
