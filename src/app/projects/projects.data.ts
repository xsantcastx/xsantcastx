/**
 * projects.data.ts — the shipped-projects list, lifted out of the component.
 *
 * The homepage's "Projects Live" stat counts this array. Left inside
 * ProjectsComponent it could only be counted by importing the component,
 * which would pull the whole lazy /projects chunk into the landing bundle —
 * and hardcoding the number on the homepage instead would drift the first
 * time a project is added here.
 */
export interface ProjectConfig {
  titleKey: string;
  descriptionKey: string;
  image: string;
  previewImage?: string;
  liveUrl: string;
  githubUrl?: string;
  featureKeys: string[];
  technologies: string[];
}

export const PROJECTS: ProjectConfig[] = [
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
      liveUrl: 'https://theluxvending.com',
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

/** How many projects are live — read by the homepage stat panel. */
export const PROJECTS_LIVE = PROJECTS.length;
