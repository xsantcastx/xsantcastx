import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-eg',
  templateUrl: './eg.component.html',
  styleUrls: ['./eg.component.css']
})
export class EgComponent {
  
  private konamiCode = [
    'arrowup', 'arrowup',
    'arrowdown', 'arrowdown',
    'arrowleft', 'arrowright',
    'arrowleft', 'arrowright',
    'b', 'a'
  ];
  private inputSequence: string[] = [];

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    this.inputSequence.push(key);
    if (this.inputSequence.length > this.konamiCode.length) {
      this.inputSequence.shift(); // keep array size
    }

    if (this.inputSequence.join('') === this.konamiCode.join('')) {
      this.triggerEasterEgg();
      this.inputSequence = [];
    }
  }

  triggerEasterEgg() {
    const overlay = document.createElement('div');
    overlay.classList.add('konami-overlay');
    overlay.textContent = '👾 KONAMI MODE ACTIVATED 👾';
    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.remove();
    }, 5000);
  }

}
