import { Routes } from '@angular/router';
import { HeroComponent } from './hero/hero.component';
import { SkillsComponent } from './skills/skills.component';
import { ProjectsComponent } from './projects/projects.component';
import { ContactComponent } from './contact/contact.component';
import { DonateComponent } from './donate/donate.component';

export const routes: Routes = [
  { path: 'home', component: HeroComponent },
  { path: 'skills', component: SkillsComponent },
  { path: 'projects', component: ProjectsComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'donate', component: DonateComponent },
  {
    path: 'guestbook',
    loadComponent: () =>
      import('./guestbook/guestbook.component').then(m => m.GuestbookComponent)
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' }
];
