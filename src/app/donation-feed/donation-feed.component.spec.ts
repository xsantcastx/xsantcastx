import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DonationFeedComponent } from './donation-feed.component';

describe('DonationFeedComponent', () => {
  let component: DonationFeedComponent;
  let fixture: ComponentFixture<DonationFeedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonationFeedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DonationFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
