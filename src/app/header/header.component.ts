import {
  Component,
  ElementRef,
  AfterViewInit,
  Renderer2,
  HostListener
} from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements AfterViewInit {
  private glitchAudio: HTMLAudioElement;

  constructor(private elRef: ElementRef, private renderer: Renderer2) {
    this.glitchAudio = new Audio('assets/g1.mp3'); // path to your glitch audio
    this.glitchAudio.volume = 0.3;
  }

  ngAfterViewInit(): void {
    const navbarTitle = this.elRef.nativeElement.querySelector('.nav-glitch');
    this.loopAmbientFlicker();
    if (navbarTitle) {
      setTimeout(() => {
        this.renderer.addClass(navbarTitle, 'glitch-start');
        this.randomGlitch(navbarTitle);
      }, 6000); // Increased delay to allow typewriter finish its first loop
    }
    
  }


  randomGlitch(el: HTMLElement) {
    setInterval(() => {
      this.renderer.removeClass(el, 'glitch-start');
      setTimeout(() => {
        this.renderer.addClass(el, 'glitch-start');
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
    }, 4800); // Match animation duration
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
    }, 1000); // flicker for 1s
  };

  const loop = () => {
    triggerFlicker();
    const nextDelay = 12000 + Math.floor(Math.random() * 13000); // 12–25 sec
    setTimeout(loop, nextDelay);
  };

  loop();
}

  
}
