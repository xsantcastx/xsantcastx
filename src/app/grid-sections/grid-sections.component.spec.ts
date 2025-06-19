import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridSectionsComponent } from './grid-sections.component';

describe('GridSectionsComponent', () => {
  let component: GridSectionsComponent;
  let fixture: ComponentFixture<GridSectionsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GridSectionsComponent]
    });
    fixture = TestBed.createComponent(GridSectionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
