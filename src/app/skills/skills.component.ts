import { Component, OnInit, inject } from '@angular/core';
import { PortfolioService } from '../portfolio.service';
import { Skills } from '../models/portfolio.models';
import { TranslationService } from '../translation.service';

@Component({
    selector: 'app-skills',
    template: `
    <section class="skills">
      <p class="skills__eyebrow">
        <span class="skills__pulse"></span>
        {{ translate('cosmic.eyebrow.skillConstellation') }}
      </p>
      <h2>{{ translate('skills.title') }}</h2>
      <p class="skills__tagline">{{ translate('cosmic.tagline.skillConstellation') }}</p>
      @if (isLoading) {
        <div class="loading">{{ translate('skills.loading') }}</div>
      }
      @if (error) {
        <div class="error">{{ translate('skills.error') }}</div>
      }
      @if (!isLoading && !error) {
        <div class="skills-grid">
          @for (skill of skills; track skill.name) {
            <div class="skill-card" [attr.aria-label]="skill.name">
              <span class="skill-card__star" aria-hidden="true"></span>
              <h3 class="skill-card__name">{{ skill.name }}</h3>
            </div>
          }
        </div>
      }
    </section>
    `,
    styleUrls: ['./skills.component.css'],
    standalone: false
})
export class SkillsComponent implements OnInit {
  private translationService = inject(TranslationService);
  
  skills: Skills[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private portfolioService: PortfolioService) {}

  ngOnInit(): void {
    this.portfolioService.getSkills().subscribe({
      next: (data) => {
        this.skills = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load skills. Please try again.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }
}