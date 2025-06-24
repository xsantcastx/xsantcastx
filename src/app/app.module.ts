import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { HeroComponent } from './hero/hero.component';
import { SkillsComponent } from './skills/skills.component';
import { ProjectsComponent } from './projects/projects.component';
import { ContactComponent } from './contact/contact.component';
import { FooterComponent } from './footer/footer.component';
import { FormsModule } from '@angular/forms';
import { NgxParticlesModule } from '@tsparticles/angular'; // If using tsparticles
import { HttpClientModule } from '@angular/common/http';
import { EgComponent } from './eg/eg.component';
import { GridSectionsComponent } from './grid-sections/grid-sections.component';
import { GuestbookComponent } from './guestbook/guestbook.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    HeroComponent,
    SkillsComponent,
    ProjectsComponent,
    ContactComponent,
    FooterComponent,
    EgComponent,
    GridSectionsComponent,
    GuestbookComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    NgxParticlesModule,
    HttpClientModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }