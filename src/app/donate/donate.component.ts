import { Component } from '@angular/core';
import { DonationFormComponent } from '../donation-form/donation-form.component';
import { DonationFeedComponent } from '../donation-feed/donation-feed.component';

@Component({
  selector: 'app-donate',
  templateUrl: './donate.component.html',
  styleUrls: ['./donate.component.css'],
  standalone: true,
    imports: [DonationFormComponent, DonationFeedComponent]
})
export class DonateComponent {

}
