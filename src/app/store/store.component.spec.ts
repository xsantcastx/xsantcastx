import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import { StoreComponent } from './store.component';
import { ProjectDetailComponent } from './project-detail.component';
import { PROJECTS, projectById } from './projects.data';
import { ActivatedRoute } from '@angular/router';

describe('StoreComponent (the front door)', () => {
  function create() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideLocationMocks()] });
    const fixture = TestBed.createComponent(StoreComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, cmp: fixture.componentInstance };
  }

  it('renders one slide per project, with a carousel landmark and a single h1', () => {
    const { el } = create();
    expect(el.querySelectorAll('.slide').length).toBe(PROJECTS.length);
    expect(el.querySelector('section[aria-roledescription="carousel"]')).not.toBeNull();
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('.slide[data-skin="decanter"]')).not.toBeNull();
    expect(el.querySelector('.slide[data-skin="cronta"]')).not.toBeNull();
    expect(el.querySelector('.slide[data-skin="eclipse"]')).not.toBeNull();
  });

  it('shows the shelves, and Decanter downloads from this site in the same tab', () => {
    const { el } = create();
    const titles = Array.from(el.querySelectorAll('.shelf-title')).map(n => n.textContent?.trim());
    expect(titles).toEqual(['Play now', 'Apps']);
    const dl = el.querySelector('.card[data-skin="decanter"] a.btn-primary') as HTMLAnchorElement;
    expect(dl.getAttribute('href')).toBe('/decanter/Decanter-0.1.2.dmg');
    expect(dl.hasAttribute('download')).toBeTrue();
    expect(dl.getAttribute('target')).toBeNull();
    expect(dl.textContent?.trim()).toBe('Download for Mac');
    expect(el.querySelector('a[href*="github"]')).toBeNull();
  });

  it('opens cronta.app as an external, noopener link and Eclipse Realms at /play', () => {
    const { el } = create();
    const ext = el.querySelector('.card[data-skin="cronta"] a.btn-primary') as HTMLAnchorElement;
    expect(ext.getAttribute('href')).toBe('https://cronta.app');
    expect(ext.getAttribute('rel')).toBe('noopener');
    const play = el.querySelector('.card[data-skin="eclipse"] a.btn-primary') as HTMLAnchorElement;
    expect(play.getAttribute('href')).toBe('/play');
  });

  it('filters by category chip and by search', () => {
    const { fixture, el, cmp } = create();
    cmp.setCategory('mac');
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.card-name')).map(n => n.textContent?.trim())).toEqual(['Decanter']);
    cmp.setCategory('all');
    cmp.query.set('time clock');
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.card-name')).map(n => n.textContent?.trim())).toEqual(['Cronta']);
    cmp.query.set('zzz');
    fixture.detectChanges();
    expect(el.querySelector('.empty')).not.toBeNull();
  });

  it('moves the carousel with the arrows and wraps', () => {
    const { cmp } = create();
    expect(cmp.index()).toBe(0);
    cmp.step(-1);
    expect(cmp.index()).toBe(PROJECTS.length - 1);
    cmp.step(1);
    expect(cmp.index()).toBe(0);
  });
});

describe('ProjectDetailComponent', () => {
  for (const project of PROJECTS) {
    it(`renders ${project.id} in its own skin with 3-5 things you can do`, () => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]), provideLocationMocks(),
          { provide: ActivatedRoute, useValue: { snapshot: { data: { projectId: project.id } } } },
        ],
      });
      const fixture = TestBed.createComponent(ProjectDetailComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.store')?.getAttribute('data-skin')).toBe(projectById(project.id)!.skin);
      expect(el.querySelector('h1')?.textContent).toContain(project.name);
      const items = el.querySelectorAll('.checks li').length;
      expect(items).toBeGreaterThanOrEqual(3);
      expect(items).toBeLessThanOrEqual(5);
    });
  }
});
