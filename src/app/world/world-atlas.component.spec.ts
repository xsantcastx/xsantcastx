import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { TranslationService } from '../translation.service';
import { ATLAS_HOTSPOTS, atlasHotspotsInMobileOrder } from '../shared/narrative/world-atlas';
import { WorldAtlasComponent } from './world-atlas.component';

describe('WorldAtlasComponent', () => {
  let fixture: ComponentFixture<WorldAtlasComponent>;
  let root: HTMLElement;
  let i18n: TranslationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorldAtlasComponent, RouterTestingModule],
      providers: [TranslationService],
    }).compileComponents();

    i18n = TestBed.inject(TranslationService);
    fixture = TestBed.createComponent(WorldAtlasComponent);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  function hotspotLinks(): HTMLAnchorElement[] {
    return Array.from(root.querySelectorAll<HTMLAnchorElement>('.atlas__link'));
  }

  function listLinks(): HTMLAnchorElement[] {
    return Array.from(root.querySelectorAll<HTMLAnchorElement>('.atlas__item'));
  }

  it('renders five data-driven hotspots that open existing dossiers', () => {
    const links = hotspotLinks();
    expect(links.map(link => link.getAttribute('href'))).toEqual(
      ATLAS_HOTSPOTS.map(spot => `/world/realms/${spot.id}`),
    );
    expect(links.map(link => link.getAttribute('aria-label'))).toEqual(
      ATLAS_HOTSPOTS.map(spot => spot.accessibleLabel),
    );
    expect(Array.from(root.querySelectorAll('.atlas__label')).map(el => el.textContent?.trim()))
      .toEqual(ATLAS_HOTSPOTS.map(spot => spot.label));
    expect(root.querySelector('a[href="/world/fivefold-lock"]')).toBeNull();
  });

  it('positions hotspots from normalized anchors, not pixels', () => {
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.atlas__hotspot'));
    expect(nodes.map(node => node.style.getPropertyValue('--ax'))).toEqual(
      ATLAS_HOTSPOTS.map(spot => `${spot.anchor.x}%`),
    );
    expect(nodes.map(node => node.style.getPropertyValue('--ay'))).toEqual(
      ATLAS_HOTSPOTS.map(spot => `${spot.anchor.y}%`),
    );
    expect(nodes.every(node => node.style.left === '' || !node.style.left.endsWith('px'))).toBeTrue();
  });

  it('keeps every hotspot keyboard reachable with a visible label', () => {
    for (const link of hotspotLinks()) {
      expect(link.tabIndex).toBeGreaterThanOrEqual(0);
      expect(link.getAttribute('href')).toBeTruthy();
      expect(link.querySelector('.atlas__label')?.textContent?.trim()).toBeTruthy();
    }
  });

  it('offers a five-item mobile fallback in spec order', () => {
    const links = listLinks();
    expect(links.map(link => link.querySelector('.atlas__item-name')?.textContent?.trim())).toEqual(
      atlasHotspotsInMobileOrder().map(spot => spot.label),
    );
    expect(links.map(link => link.getAttribute('href'))).toEqual(
      atlasHotspotsInMobileOrder().map(spot => `/world/realms/${spot.id}`),
    );
    expect(links.map(link => link.getAttribute('aria-label'))).toEqual(
      atlasHotspotsInMobileOrder().map(spot => spot.accessibleLabel),
    );
  });

  it('uses a responsive contained picture and decorative image text', () => {
    const img = root.querySelector<HTMLImageElement>('.atlas__art img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('width')).toBe('1536');
    expect(img?.getAttribute('height')).toBe('1024');
    expect(img?.getAttribute('src')).toContain('fractured-realms-atlas-1536.jpg');
    const sources = Array.from(root.querySelectorAll<HTMLSourceElement>('.atlas__art source'));
    expect(sources.map(source => source.getAttribute('srcset'))).toEqual([
      'assets/images/fractured-realms-atlas-768.webp',
      'assets/images/fractured-realms-atlas-1280.webp',
      'assets/images/fractured-realms-atlas-1536.webp',
    ]);
  });

  it('translates atlas chrome without rewriting spec labels', () => {
    expect(root.querySelector('.atlas__hint')?.textContent?.trim()).toBe(
      'Choose a realm to inspect its dossier.',
    );
    i18n.setLanguage('es');
    fixture.detectChanges();
    expect(root.querySelector('.atlas')?.getAttribute('aria-label')).toBe(
      'Atlas de los Reinos Fracturados',
    );
    expect(root.querySelector('.atlas__hint')?.textContent?.trim()).toBe(
      'Elige un reino para inspeccionar su expediente.',
    );
    expect(root.textContent).toContain('Luminous Realm');
    expect(root.textContent).not.toContain('Heliograph Court');
    expect(Array.from(root.querySelectorAll('.atlas__label')).map(el => el.textContent?.trim()))
      .toEqual(ATLAS_HOTSPOTS.map(spot => spot.label));
  });
});
