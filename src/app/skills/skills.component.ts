import { Component, OnInit } from '@angular/core';
import { PortfolioService } from '../portfolio.service';
import { Skills } from '../models/portfolio.models';

@Component({
  selector: 'app-skills',
  template: `
    <section class="skills">
      <h2>My Skills</h2>
      <div *ngIf="isLoading" class="loading">Loading...</div>
      <div *ngIf="error" class="error">{{ error }}</div>
      <div class="skills-grid" *ngIf="!isLoading && !error">
        <div class="skill-card" *ngFor="let skill of skills">
          {{ skill.name }}
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./skills.component.css']
})
export class SkillsComponent implements OnInit {
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
}