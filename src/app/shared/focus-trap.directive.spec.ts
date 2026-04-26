import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FocusTrapDirective } from './focus-trap.directive';

/*
  Test host — three buttons inside a focus-trapped container, two outside.
  Outside buttons exist so we can prove that Tab/Shift+Tab don't escape the
  container while the trap is engaged. We bind `active` from a parent input
  so we can flip it programmatically.
*/
@Component({
  template: `
    <button id="before" type="button">Before</button>
    <div [appFocusTrap]="active" (escape)="onEscape()" data-testid="trap">
      <button id="first" type="button">First</button>
      <button id="middle" type="button">Middle</button>
      <button id="last" type="button">Last</button>
    </div>
    <button id="after" type="button">After</button>
  `,
  standalone: false,
})
class HostComponent {
  active = false;
  escapeCount = 0;
  onEscape() {
    this.escapeCount++;
  }
}

function tabKey(target: Element, shift = false): boolean {
  const ev = new KeyboardEvent('keydown', {
    key: 'Tab',
    code: 'Tab',
    bubbles: true,
    cancelable: true,
    shiftKey: shift,
  });
  return target.dispatchEvent(ev);
}

function escapeKey(target: Element): boolean {
  const ev = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  return target.dispatchEvent(ev);
}

describe('FocusTrapDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FocusTrapDirective, HostComponent],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('does nothing while inactive', () => {
    const before = fixture.nativeElement.querySelector('#before') as HTMLButtonElement;
    before.focus();
    expect(document.activeElement).toBe(before);
  });

  it('moves focus into the trap on activation (skips the close-button match)', fakeAsync(() => {
    // Park focus on an outside element first so we can prove it moved.
    (fixture.nativeElement.querySelector('#before') as HTMLButtonElement).focus();
    host.active = true;
    fixture.detectChanges();
    // ngOnChanges schedules focus in a requestAnimationFrame — flush.
    tick(100);
    fixture.detectChanges();
    const first = fixture.nativeElement.querySelector('#first') as HTMLElement;
    expect(document.activeElement).toBe(first);
  }));

  it('wraps Tab from last → first', fakeAsync(() => {
    host.active = true;
    fixture.detectChanges();
    tick(100);
    const last = fixture.nativeElement.querySelector('#last') as HTMLButtonElement;
    last.focus();
    tabKey(last, false);
    fixture.detectChanges();
    const first = fixture.nativeElement.querySelector('#first') as HTMLElement;
    expect(document.activeElement).toBe(first);
  }));

  it('wraps Shift+Tab from first → last', fakeAsync(() => {
    host.active = true;
    fixture.detectChanges();
    tick(100);
    const first = fixture.nativeElement.querySelector('#first') as HTMLButtonElement;
    first.focus();
    tabKey(first, true);
    fixture.detectChanges();
    const last = fixture.nativeElement.querySelector('#last') as HTMLElement;
    expect(document.activeElement).toBe(last);
  }));

  it('emits (escape) when Esc is pressed inside the trap', fakeAsync(() => {
    host.active = true;
    fixture.detectChanges();
    tick(100);
    const middle = fixture.nativeElement.querySelector('#middle') as HTMLButtonElement;
    middle.focus();
    expect(host.escapeCount).toBe(0);
    escapeKey(middle);
    expect(host.escapeCount).toBe(1);
  }));

  it('restores focus to the previously focused element on deactivate', fakeAsync(() => {
    const before = fixture.nativeElement.querySelector('#before') as HTMLButtonElement;
    before.focus();
    expect(document.activeElement).toBe(before);

    host.active = true;
    fixture.detectChanges();
    tick(100);
    expect(document.activeElement).not.toBe(before);

    host.active = false;
    fixture.detectChanges();
    expect(document.activeElement).toBe(before);
  }));
});
