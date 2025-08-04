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
import { Auth, signInWithRedirect, signOut, GoogleAuthProvider, user, signInAnonymously } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { getRedirectResult, UserCredential, onAuthStateChanged, signInWithPopup } from 'firebase/auth';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: false
})
export class HeaderComponent implements AfterViewInit, OnInit {  // 👈 implements OnInit
  private glitchAudio: HTMLAudioElement;
  private auth = inject(Auth);
  private appRef = inject(ApplicationRef);

  user$: Observable<any>;

  ngOnInit(): void {
    // Initialization logic can go here if needed
  }

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2
  ) {
    this.glitchAudio = new Audio('assets/g1.mp3');
    this.glitchAudio.volume = 0.3;

    // Always initialize user$ here
    this.user$ = user(this.auth);
  }

  isAuthReady = false; // Track when Firebase is ready
userData: any = null;



loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  signInWithPopup(this.auth, provider)
    .then(result => {
      //console.log('User signed in:', result.user);
    })
    .catch(err => console.error('Login failed:', err));
}


  logout() {
    runInInjectionContext(this.appRef.injector, () => {
      signOut(this.auth).catch(err => console.error('Logout failed:', err));
    });
  }

  loginAnonymously() {
    runInInjectionContext(this.appRef.injector, () => {
      signInAnonymously(this.auth).catch(err => console.error('Anonymous login failed:', err));
    });
  }

  loginOpen = false;

  toggleLoginMenu(event: MouseEvent) {
    event.stopPropagation();
    this.loginOpen = !this.loginOpen;
  }

  @HostListener('document:click')
  closeMenu() {
    this.loginOpen = false;
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
