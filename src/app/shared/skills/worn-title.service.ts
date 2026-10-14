/**
 * worn-title.service.ts — which skill's title the Keeper wears beside their
 * rank (the name-tag flourish, skill-titles.ts).
 *
 * A device preference, like the Character hub's last tab: it stores only the
 * skill id, never the title, so the worn title always reads the skill's
 * current one (it grows from "Vein-Reader" to "Seam-Sage" by itself) and a
 * save can never claim a title its XP has not earned. Nothing here is
 * progression, so it is not a synced blob.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

import { SKILLS, type SkillId } from './skill.model';

export const WORN_TITLE_KEY = 'godforge-worn-title';

@Injectable({ providedIn: 'root' })
export class WornTitleService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly worn$$ = new BehaviorSubject<SkillId | null>(this.read());
  readonly worn$ = this.worn$$.asObservable();

  get worn(): SkillId | null { return this.worn$$.value; }

  /** Wear a skill's title, or take it off with null. */
  wear(skill: SkillId | null): void {
    const next = skill && SKILLS.some(s => s.id === skill) ? skill : null;
    this.worn$$.next(next);
    if (!this.isBrowser) return;
    try {
      if (next) localStorage.setItem(WORN_TITLE_KEY, next); else localStorage.removeItem(WORN_TITLE_KEY);
    } catch { /* private mode */ }
  }

  private read(): SkillId | null {
    if (!this.isBrowser) return null;
    try {
      const value = localStorage.getItem(WORN_TITLE_KEY);
      return SKILLS.some(s => s.id === value) ? value as SkillId : null;
    } catch {
      return null;
    }
  }
}
