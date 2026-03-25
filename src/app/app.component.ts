import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SeoService } from './seo.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent implements OnInit {
  title = 'xsantcastx';
  private platformId = inject(PLATFORM_ID);

  constructor(private seo: SeoService) {}

  ngOnInit() {
    this.seo.init();

    if (!isPlatformBrowser(this.platformId)) return;

    const triggerRandomGlitch = () => {
      const keywords = document.querySelectorAll('.keyword');
      keywords.forEach((el) => {
        if (Math.random() < 0.1) {
          el.classList.add('glitch');
          setTimeout(() => el.classList.remove('glitch'), 300);
        }
      });
    };

    setInterval(() => {
      if (document.body.classList.contains('glitch-out')) {
        triggerRandomGlitch();
      }
    }, 2000);
  }
}
