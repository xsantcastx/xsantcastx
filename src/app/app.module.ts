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
import { NgxParticlesModule } from '@tsparticles/angular';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { EgComponent } from './eg/eg.component';
import { GridSectionsComponent } from './grid-sections/grid-sections.component';
import { GuestbookComponent } from './guestbook/guestbook.component';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { provideAuth, getAuth } from '@angular/fire/auth';  // <-- add this
import { environment } from '../environments/environment';
import { ResumeCardComponent } from './resume-card/resume-card.component';
import { AboutmeCardComponent } from "./aboutme-card/aboutme-card.component";
import { CryptoCardComponent } from './crypto-card/crypto-card.component';
import { WalletSummaryComponent } from './wallet-summary/wallet-summary.component';
import { TransactionListComponent } from './transaction-list/transaction-list.component';
import { DonationFormComponent } from './donation-form/donation-form.component';
import { DonationFeedComponent } from './donation-feed/donation-feed.component';
import { DonateComponent } from './donate/donate.component';
import { NewsFeedComponent } from './news-feed/news-feed.component';
import { ServicesComponent } from './services/services.component';
import { AboutComponent } from './about/about.component';
import { CommonModule } from '@angular/common';


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
    GuestbookComponent,
    CryptoCardComponent,
    WalletSummaryComponent,
    TransactionListComponent,
    DonationFormComponent,
    DonationFeedComponent,
    DonateComponent,
    NewsFeedComponent,
    ServicesComponent,
    AboutComponent
  ],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    NgxParticlesModule,
    CommonModule,
    ResumeCardComponent,
    AboutmeCardComponent
],
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideDatabase(() => getDatabase()),
    provideAuth(() => getAuth()),  // <-- add here instead of AngularFireAuthModule
    provideHttpClient(withInterceptorsFromDi())
  ]
})
export class AppModule { }
