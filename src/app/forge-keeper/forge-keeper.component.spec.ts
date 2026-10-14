import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ForgeKeeperComponent } from './forge-keeper.component';
import { EasterEggService } from '../shared/easter-eggs/easter-egg.service';

describe('ForgeKeeperComponent Self-Aware egg', () => {
  async function visit(alreadyFound: boolean): Promise<jasmine.Spy> {
    await TestBed.configureTestingModule({
      imports: [ForgeKeeperComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const eggs = TestBed.inject(EasterEggService);
    spyOn(eggs, 'init').and.resolveTo();
    spyOn(eggs, 'isFound').and.callFake(id => alreadyFound && id === 'forge-self-aware');
    const trigger = spyOn(eggs, 'trigger').and.resolveTo();
    const fixture = TestBed.createComponent(ForgeKeeperComponent);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 100));
    fixture.destroy();
    return trigger;
  }

  it('does not fire again once it has been found', async () => {
    const trigger = await visit(true);
    expect(trigger).not.toHaveBeenCalledWith('forge-self-aware');
  });

  it('fires on the first visit', async () => {
    const trigger = await visit(false);
    expect(trigger).toHaveBeenCalledWith('forge-self-aware');
  });
});
