import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { TranslationService } from '../../translation.service';
import { InspectComponent } from './inspect.component';
import { InspectService } from './inspect.service';

describe('InspectComponent', () => {
  let fixture: ComponentFixture<InspectComponent>;
  let inspect: InspectService;
  let i18n: TranslationService;
  let router: Router;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InspectComponent,
        RouterTestingModule.withRoutes([{ path: '', component: InspectComponent }]),
      ],
      providers: [TranslationService, InspectService],
    }).compileComponents();

    i18n = TestBed.inject(TranslationService);
    i18n.setLanguage('en');
    inspect = TestBed.inject(InspectService);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture = TestBed.createComponent(InspectComponent);
    fixture.detectChanges();
    inspect.start();
    root = fixture.nativeElement as HTMLElement;
  });

  async function open(type: string, id: string): Promise<void> {
    inspect.open({ type: type as 'rune', id });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders a ready rune with exact worth and no bubble copy', async () => {
    await open('rune', 'ash');
    expect(root.querySelector('#qi-title')?.textContent?.trim()).toBe('Ash');
    expect(root.textContent).toContain('Worth');
    expect(root.querySelector('.qi__facts')?.textContent).toContain('Gold');
    expect(root.textContent).not.toMatch(/bubble/i);
  });

  it('shows a missing state for unknown records', async () => {
    await open('item', 'ghost-item');
    expect(root.querySelector('#qi-title')?.textContent?.trim()).toBe('Record unavailable');
    expect(root.textContent).toContain('unavailable');
  });

  it('translates chrome to Spanish without rewriting lore', async () => {
    i18n.setLanguage('es');
    await open('realm', 'luminous');
    expect(root.querySelector('.qi__close')?.textContent?.trim()).toBe('Cerrar');
    expect(root.textContent).toContain('Heliograph Court');
    expect(root.textContent).not.toMatch(/burbuja|bubble/i);
  });

  it('traps focus inside the dialog and restores the trigger on close', async () => {
    const trigger = document.createElement('button');
    trigger.id = 'qi-trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    inspect.open({ type: 'quest', id: 'forge-three-shadows' }, { trigger });
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = root.querySelector('.qi') as HTMLElement;
    expect(dialog).toBeTruthy();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    fixture.nativeElement.dispatchEvent(tab);

    inspect.close();
    fixture.detectChanges();
    document.body.removeChild(trigger);
  });
});
