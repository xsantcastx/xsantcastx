import { Component, inject } from '@angular/core';
import { TranslationService } from '../translation.service';

@Component({
  selector: 'app-aboutme-card',
  imports: [],
  templateUrl: './aboutme-card.component.html',
  styleUrl: './aboutme-card.component.css'
})
export class AboutmeCardComponent {
  private translationService = inject(TranslationService);

  translate(key: string): string {
    return this.translationService.translate(key);
  }
}
