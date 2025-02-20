import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.css']
})
export class HeroComponent {
  onHireMe() {
    alert('Contact me to hire!');
    // You can add navigation or form logic here
  }
}