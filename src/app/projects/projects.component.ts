import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../translation.service';

interface Project {
  title: string;
  description: string;
  image: string;
  liveUrl: string;
  githubUrl?: string;
  features: string[];
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
  
  projects: Project[] = [
    {
      title: 'The Stone Ceramics',
      description: 'Premium ceramic tiles e-commerce platform with advanced product filtering, 3D visualization, and multilingual support.',
      image: 'https://via.placeholder.com/400x250/0a0a1a/00ffcc?text=The+Stone',
      liveUrl: 'https://tstone456--tstone-e1de6.us-east4.hosted.app/',
      features: [
        'Product catalog with advanced filtering',
        'Multilingual support (Spanish/English)',
        'Technical specifications viewer',
        'Contact and consultation system',
        'Responsive design for all devices'
      ],
      technologies: ['Angular', 'TypeScript', 'Firebase', 'SCSS', 'PWA']
    },
    {
      title: 'Xengrave Laser Studio',
      description: 'Custom laser engraving service platform with real-time ordering, proof generation, and project management.',
      image: 'https://via.placeholder.com/400x250/0a0a1a/ff00ff?text=Xengrave',
      liveUrl: 'https://xengrave-88c76.web.app/',
      features: [
        'Custom order configuration',
        '24h proof generation system',
        'Gallery of past work',
        'Pricing calculator',
        'Order tracking system'
      ],
      technologies: ['React', 'Firebase', 'Stripe API', 'Material-UI', 'Node.js']
    },
    {
      title: 'The Lux Vending',
      description: 'Business partnership platform for vending machine placement with earnings calculator and location management.',
      image: 'https://via.placeholder.com/400x250/0a0a1a/00ffcc?text=Lux+Vending',
      liveUrl: 'http://theluxvending.com',
      features: [
        'Interactive earnings calculator',
        'Business eligibility checker',
        'Service area mapping',
        'Partnership application system',
        'ROI analytics dashboard'
      ],
      technologies: ['HTML5', 'CSS3', 'JavaScript', 'PHP', 'MySQL']
    }
  ];

  ngOnInit(): void {
    // Projects are already defined above
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