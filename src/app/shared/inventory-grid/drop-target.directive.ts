/**
 * drop-target.directive.ts — `[appDropTarget]="target"`: register this element as a place items can be dropped
 * (item-drag.service.ts). The binding is the DropTarget (accepts / over / leave / drop).
 */
import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ItemDragService, type DropTarget } from './item-drag.service';

@Directive({ selector: '[appDropTarget]', standalone: true })
export class DropTargetDirective implements OnInit, OnDestroy {
  @Input({ required: true }) appDropTarget!: DropTarget | null;
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly drag = inject(ItemDragService);
  private off?: () => void;

  ngOnInit(): void {
    const proxy: DropTarget = {
      accepts: h => !!this.appDropTarget?.accepts(h),
      over: (h, x, y) => this.appDropTarget?.over?.(h, x, y),
      leave: () => this.appDropTarget?.leave?.(),
      drop: (h, x, y) => this.appDropTarget?.drop(h, x, y) ?? false,
    };
    this.off = this.drag.register(this.el.nativeElement, proxy);
  }

  ngOnDestroy(): void { this.off?.(); }
}
