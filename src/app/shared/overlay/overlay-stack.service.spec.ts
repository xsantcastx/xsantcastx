import { TestBed } from '@angular/core/testing';
import { OverlayStackService } from './overlay-stack.service';

describe('OverlayStackService', () => {
  let service: OverlayStackService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OverlayStackService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  function pressEscape(): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    return event;
  }

  it('closes LIFO: Escape closes B then A', () => {
    const closed: string[] = [];
    service.push('a', () => closed.push('a'));
    service.push('b', () => closed.push('b'));

    pressEscape();
    expect(closed).toEqual(['b']);

    pressEscape();
    expect(closed).toEqual(['b', 'a']);
  });

  it('unregister prevents a stale close', () => {
    const closed: string[] = [];
    const unregA = service.push('a', () => closed.push('a'));
    service.push('b', () => closed.push('b'));

    unregA();
    pressEscape();
    expect(closed).toEqual(['b']);

    pressEscape();
    expect(closed).toEqual(['b']);
  });

  it('empty stack: Escape is a no-op and does not throw', () => {
    expect(() => pressEscape()).not.toThrow();
    expect(service.closeTop()).toBeFalse();
  });

  it('ignores nested closeTop while close() is running', () => {
    const closed: string[] = [];
    service.push('a', () => closed.push('a'));
    service.push('b', () => {
      closed.push('b');
      service.closeTop();
    });

    expect(service.closeTop()).toBeTrue();
    expect(closed).toEqual(['b']);

    expect(service.closeTop()).toBeTrue();
    expect(closed).toEqual(['b', 'a']);
  });
});
