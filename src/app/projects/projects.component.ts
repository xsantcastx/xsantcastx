import { Component, OnInit, inject } from '@angular/core';
import { TranslationService } from '../translation.service';
import { CommonModule } from '@angular/common';
import { PROJECTS, ProjectConfig } from './projects.data';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css'],
  standalone: true,
    imports: [CommonModule]
})
export class ProjectsComponent implements OnInit {
  private translationService = inject(TranslationService);

  projects: ProjectConfig[] = PROJECTS;

  ngOnInit(): void {
    // Data defined statically for now
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }
}

