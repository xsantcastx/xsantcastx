import { Component, HostListener } from '@angular/core';

interface GridItem {
  title: string;
  content: string;
  active: boolean;
}

@Component({
  selector: 'app-grid-sections',
  templateUrl: './grid-sections.component.html',
  styleUrls: ['./grid-sections.component.css'],
  standalone: false
})
export class GridSectionsComponent {
  gridItems: GridItem[] = [
    {
      title: 'Professional Summary',
      content: '', // Now handled by <app-resume-card>
      active: false,
    },
    {
      title: 'About Me',
      content: ``,
      active: false,
    },
    {
      title: 'Crypto',
      content: `
        <p>Passionate about blockchain and cryptocurrencies, I analyze market trends and explore decentralized technologies to stay ahead in the digital realm.</p>
      `,
      active: false,
    },
    {
      title: 'Gaming',
      content: `
        <p>From retro classics to modern AAA titles, I love exploring gaming culture, tech reviews, and insights into game development.</p>
      `,
      active: false,
    },
  ];

  toggleItem(index: number): void {
    this.gridItems.forEach((item, i) => {
      item.active = i === index ? !item.active : false;
    });
    document.body.style.overflow = this.gridItems.some(item => item.active) ? 'hidden' : 'auto';
  }

  closeItem(index: number): void {
    this.gridItems[index].active = false;
    document.body.style.overflow = 'auto';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const isInsideActiveItem = target.closest('.grid-item.active');
    const isGridTrigger = target.classList.contains('grid-title');
    if (!isInsideActiveItem && !isGridTrigger) {
      this.gridItems.forEach(item => item.active = false);
      document.body.style.overflow = 'auto';
    }
  }
}
