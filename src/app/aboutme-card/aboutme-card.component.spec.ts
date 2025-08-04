import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AboutmeCardComponent } from './aboutme-card.component';

describe('AboutmeCardComponent', () => {
  let component: AboutmeCardComponent;
  let fixture: ComponentFixture<AboutmeCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutmeCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AboutmeCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
