import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../translation.service';

interface Service {
  title: string;
  description: string;
  icon: string;
  technologies: string[];
}

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrl: './services.component.css',
  standalone: false
})
export class ServicesComponent {
  private translationService = inject(TranslationService);
  
  services: Service[] = [
    {
      title: 'services.frontend.title',
      description: 'services.frontend.desc',
      icon: 'fas fa-code',
      technologies: ['React', 'Angular', 'Vue.js', 'TypeScript', 'SCSS']
    },
    {
      title: 'services.backend.title',
      description: 'services.backend.desc',
      icon: 'fas fa-server',
      technologies: ['Node.js', 'Express', 'Python', 'MongoDB', 'PostgreSQL']
    },
    {
      title: 'services.fullstack.title',
      description: 'services.fullstack.desc',
      icon: 'fas fa-layers',
      technologies: ['MEAN Stack', 'MERN Stack', 'Firebase', 'AWS', 'Docker']
    },
    {
      title: 'services.mobile.title',
      description: 'services.mobile.desc',
      icon: 'fas fa-mobile-alt',
      technologies: ['React Native', 'Flutter', 'Ionic', 'PWA', 'Cordova']
    }
  ];

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
