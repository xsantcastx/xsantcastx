import { Component, OnInit, inject } from '@angular/core';
import { PortfolioService } from '../portfolio.service';
import { Skills } from '../models/portfolio.models';
import { TranslationService } from '../translation.service';

@Component({
    selector: 'app-skills',
    template: `
    <section class="skills">
      <h2>{{ translate('skills.title') }}</h2>
      <div *ngIf="isLoading" class="loading">{{ translate('skills.loading') }}</div>
      <div *ngIf="error" class="error">{{ translate('skills.error') }}</div>
      <div class="skills-grid" *ngIf="!isLoading && !error">
        <div class="skill-card" *ngFor="let skill of skills">
          {{ skill.name }}
        </div>
      </div>
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