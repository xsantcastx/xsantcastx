import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HeroComponent } from './hero/hero.component';
import { SkillsComponent } from './skills/skills.component';
import { ProjectsComponent } from './projects/projects.component';
import { ContactComponent } from './contact/contact.component';
import { DonateComponent } from './donate/donate.component';
import { RouteTitles } from './shared/title-strategy.service';

const routes: Routes = [
  { 
    path: 'home', 
    component: HeroComponent,
    title: RouteTitles.home,
    data: { 
      description: 'Welcome to xsantcastx - Full Stack Developer specializing in modern web development and digital solutions.',
      keywords: 'full stack developer, web development, angular, typescript, portfolio'
    }
  },
  { 
    path: 'skills', 
    component: SkillsComponent,
    title: RouteTitles.skills,
    data: { 
      description: 'Technical skills and expertise in modern web technologies, frameworks, and development tools.',
      keywords: 'technical skills, programming languages, frameworks, web development, expertise'
    }
  },
  { 
    path: 'projects', 
    component: ProjectsComponent,
    title: RouteTitles.projects,
    data: { 
      description: 'Portfolio of recent projects showcasing web development, application design, and technical solutions.',
      keywords: 'portfolio, projects, web applications, development work, case studies'
    }
  },
  { 
    path: 'contact', 
    component: ContactComponent,
    title: RouteTitles.contact,
    data: { 
      description: 'Get in touch for project collaboration, consultation, or development services.',
      keywords: 'contact, hire developer, project consultation, web development services'
    }
  },
  { 
    path: 'donate', 
    component: DonateComponent,
    title: RouteTitles.donate,
    data: { 
      description: 'Support my work and open source contributions through donations and sponsorship.',
      keywords: 'donate, support, sponsorship, open source, contributions'
    }
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }