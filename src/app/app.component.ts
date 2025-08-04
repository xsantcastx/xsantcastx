import { Component } from '@angular/core';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent {
  title = 'xsantcastx';

  ngOnInit() {
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
