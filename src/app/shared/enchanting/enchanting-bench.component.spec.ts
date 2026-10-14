import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EnchantingBenchComponent } from './enchanting-bench.component';

describe('EnchantingBenchComponent with no runes', () => {
  beforeEach(() => {
    try { localStorage.setItem('preferred-language', 'en'); } catch { /* private mode */ }
  });

  it('says "no runes yet" exactly once', async () => {
    await TestBed.configureTestingModule({ imports: [EnchantingBenchComponent], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(EnchantingBenchComponent);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 100));

    // A piece of gear that can take a rune, and an empty drawer: the state where
    // both the Additive box and the button used to print the same sentence.
    const c = fixture.componentInstance as any;
    c.socketables = [{
      item: { id: 'x', name: 'Test Blade', rarity: 'common', slot: 'weapon' },
      art: null, filled: 0, count: 2,
    }];
    c.drawer = [];
    c.selected = null;
    c.buildCta();
    c.cdr.markForCheck();
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.split('You have no runes yet').length - 1).toBe(1);
  });
});
