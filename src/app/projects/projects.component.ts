import { Component, OnInit } from '@angular/core';
import { PortfolioService } from '../portfolio.service';
import { Projects } from '../models/portfolio.models';

@Component({
    selector: 'app-projects',
    template: `
    <section class="projects">
      <h2>Featured Projects</h2>
      <div class="projects-grid">
        <div class="project-card" *ngFor="let project of projects">
          <h3>{{ project.title }}</h3>
          <p>{{ project.description }}</p>
        </div>
      </div>
    </section>
  `,
    styleUrls: ['./projects.component.css'],
    standalone: false
})
export class ProjectsComponent implements OnInit {
  projects: Projects[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private portfolioService: PortfolioService) {}

  ngOnInit(): void {
    this.portfolioService.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load projects. Please try again.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }
}