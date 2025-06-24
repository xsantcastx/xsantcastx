import { Component, AfterViewInit, ElementRef} from '@angular/core';

@Component({
    selector: 'app-hero',
    templateUrl: './hero.component.html',
    styleUrls: ['./hero.component.css'],
    standalone: false
})
export class HeroComponent {
  constructor(private elRef: ElementRef) {}

  ngAfterViewInit() {
    const sections = this.elRef.nativeElement.querySelectorAll("section");

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        } else {
          entry.target.classList.remove("visible");
        }
      });
    }, { threshold: 0.5 });

    sections.forEach((section: Element) => observer.observe(section));
  }
}

