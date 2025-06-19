import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EgComponent } from './eg.component';

describe('EgComponent', () => {
  let component: EgComponent;
  let fixture: ComponentFixture<EgComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EgComponent]
    });
    fixture = TestBed.createComponent(EgComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
