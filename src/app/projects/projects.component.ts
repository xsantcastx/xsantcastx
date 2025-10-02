import { Component, OnInit, inject } from '@angular/core';
import { TranslationService } from '../translation.service';

interface ProjectConfig {
  titleKey: string;
  descriptionKey: string;
  image: string;
  previewImage?: string;
  liveUrl: string;
  githubUrl?: string;
  featureKeys: string[];
  technologies: string[];
}

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css'],
  standalone: false
})
export class ProjectsComponent implements OnInit {
  private translationService = inject(TranslationService);

  projects: ProjectConfig[] = [
    {
      titleKey: 'projects.items.stone.title',
      descriptionKey: 'projects.items.stone.description',
      image: 'assets/placeholder-stone.svg',
      previewImage: 'assets/placeholder-stone.svg',
      liveUrl: 'https://tstone456--tstone-e1de6.us-east4.hosted.app/',
      featureKeys: [
        'projects.items.stone.features.catalog',
        'projects.items.stone.features.multilingual',
        'projects.items.stone.features.specs',
        'projects.items.stone.features.consultation',
        'projects.items.stone.features.responsive'
      ],
      technologies: ['Angular', 'TypeScript', 'Firebase', 'SCSS', 'PWA']
    },
    {
      titleKey: 'projects.items.xengrave.title',
      descriptionKey: 'projects.items.xengrave.description',
      image: 'assets/placeholder-xengrave.svg',
      previewImage: 'assets/placeholder-xengrave.svg',
      liveUrl: 'https://xengrave-88c76.web.app/',
      featureKeys: [
        'projects.items.xengrave.features.configuration',
        'projects.items.xengrave.features.proof',
        'projects.items.xengrave.features.gallery',
        'projects.items.xengrave.features.pricing',
        'projects.items.xengrave.features.tracking'
      ],
      technologies: ['React', 'Firebase', 'Stripe API', 'Material-UI', 'Node.js']
    },
    {
      titleKey: 'projects.items.lux.title',
      descriptionKey: 'projects.items.lux.description',
      image: 'assets/placeholder-lux.svg',
      previewImage: 'assets/placeholder-lux.svg',
      liveUrl: 'http://theluxvending.com',
      featureKeys: [
        'projects.items.lux.features.calculator',
        'projects.items.lux.features.eligibility',
        'projects.items.lux.features.mapping',
        'projects.items.lux.features.application',
        'projects.items.lux.features.analytics'
      ],
      technologies: ['HTML5', 'CSS3', 'JavaScript', 'PHP', 'MySQL']
    }
  ];

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

