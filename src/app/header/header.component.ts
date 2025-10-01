import {
  Component,
  ElementRef,
  AfterViewInit,
  Renderer2,
  HostListener,
  inject,
  ApplicationRef,
  runInInjectionContext,
  OnInit
} from '@angular/core';
import { TranslationService } from '../translation.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: false
})
export class HeaderComponent implements AfterViewInit, OnInit {
  private glitchAudio: HTMLAudioElement;
  private appRef = inject(ApplicationRef);
  
  currentLang: string = 'en';

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2,
    private translationService: TranslationService
  ) {
    this.glitchAudio = new Audio('assets/g1.mp3');
    this.glitchAudio.volume = 0.3;
  }

  ngOnInit(): void {
    this.translationService.currentLanguage$.subscribe(lang => {
      this.currentLang = lang;
    });
  }

  setLanguage(language: string): void {
    this.translationService.setLanguage(language);
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  ngAfterViewInit(): void {
  const navbarTitle = this.elRef.nativeElement.querySelector('.nav-glitch');
  this.loopAmbientFlicker();
  if (navbarTitle) {
    setTimeout(() => {
      this.renderer.addClass(navbarTitle, 'header-glitch');
      this.randomGlitch(navbarTitle);
    }, 6000);
  }
}


  randomGlitch(el: HTMLElement) {
  setInterval(() => {
    this.renderer.removeClass(el, 'header-glitch');
    setTimeout(() => {
      this.renderer.addClass(el, 'header-glitch');
    }, 100);
  }, this.getRandomDelay());
}


  getRandomDelay(): number {
    return 4000 + Math.floor(Math.random() * 6000);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (event.key.toLowerCase() === 'x') {
      this.triggerGlitch();
    }
  }

  triggerGlitch() {
    const body = document.body;
    this.renderer.addClass(body, 'glitch-out');

    const overlay = document.getElementById('glitchOverlay');
    if (overlay) {
      this.renderer.addClass(overlay, 'active');
      setTimeout(() => {
        this.renderer.removeClass(overlay, 'active');
      }, 4800);
    }

    this.glitchAudio.currentTime = 0;
    this.glitchAudio.play();

    setTimeout(() => {
      this.renderer.removeClass(body, 'glitch-out');
    }, 4800);
  }

  loopAmbientFlicker() {
    const body = document.body;
    const triggerFlicker = () => {
      body.classList.add('flicker');
      setTimeout(() => {
        body.classList.remove('flicker');
      }, 1000);
    };

    const loop = () => {
      triggerFlicker();
      const nextDelay = 12000 + Math.floor(Math.random() * 13000);
      setTimeout(loop, nextDelay);
    };
    loop();
  }
}
