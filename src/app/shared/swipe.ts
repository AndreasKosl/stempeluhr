import { Directive, ElementRef, inject, output } from '@angular/core';

/** Ab dieser Strecke (px) wird gewechselt – oder früher bei einem schnellen Wisch */
const DISTANCE = 80;
const FLICK_DISTANCE = 30;
const FLICK_SPEED = 0.4; // px/ms

/**
 * Horizontales Wischen per Touch. Der Inhalt folgt dem Finger; beim Loslassen
 * wird `swipe` mit +1 (nach links gewischt → weiter) bzw. -1 (nach rechts → zurück) ausgelöst.
 * Vertikales Scrollen bleibt dem Browser überlassen (touch-action: pan-y).
 */
@Directive({
  selector: '[appSwipe]',
  host: {
    style: 'touch-action: pan-y pinch-zoom',
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp($event)',
    '(pointercancel)': 'onCancel()',
  },
})
export class Swipe {
  readonly swipe = output<1 | -1>();

  private el: HTMLElement = inject(ElementRef).nativeElement;
  private id: number | null = null;
  private x0 = 0;
  private y0 = 0;
  private t0 = 0;
  private dx = 0;
  private lock: 'h' | 'v' | null = null;
  private swallowClick = false;

  constructor() {
    // Nach einem Wisch darf kein Tipp auf einen Tag/Button durchrutschen
    this.el.addEventListener(
      'click',
      (e) => {
        if (!this.swallowClick) return;
        this.swallowClick = false;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );
  }

  protected onDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    this.id = e.pointerId;
    this.x0 = e.clientX;
    this.y0 = e.clientY;
    this.t0 = e.timeStamp;
    this.dx = 0;
    this.lock = null;
    this.swallowClick = false;
  }

  protected onMove(e: PointerEvent) {
    if (e.pointerId !== this.id) return;
    const dx = e.clientX - this.x0;
    const dy = e.clientY - this.y0;
    if (!this.lock) {
      if (Math.hypot(dx, dy) < 10) return;
      this.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (this.lock === 'h') {
        this.el.setPointerCapture(e.pointerId);
        this.el.style.transition = 'none';
        this.el.style.opacity = '';
      }
    }
    if (this.lock !== 'h') return;
    this.dx = dx;
    this.el.style.transform = `translateX(${dx}px)`;
  }

  protected onUp(e: PointerEvent) {
    if (e.pointerId !== this.id) return;
    const horizontal = this.lock === 'h';
    const dx = this.dx;
    const speed = Math.abs(dx) / Math.max(1, e.timeStamp - this.t0);
    this.reset();
    if (!horizontal) return;
    this.swallowClick = true;
    setTimeout(() => (this.swallowClick = false), 400);
    const commit = Math.abs(dx) > DISTANCE || (Math.abs(dx) > FLICK_DISTANCE && speed > FLICK_SPEED);
    if (commit) this.slide(dx < 0 ? 1 : -1);
    else this.snapBack();
  }

  protected onCancel() {
    if (this.lock === 'h') this.snapBack();
    this.reset();
  }

  private reset() {
    this.id = null;
    this.lock = null;
    this.dx = 0;
  }

  private snapBack() {
    this.el.style.transition = 'transform 180ms ease-out';
    this.el.style.transform = '';
  }

  /** Alten Inhalt hinausschieben, umschalten, neuen Inhalt von der anderen Seite hereinschieben */
  private slide(dir: 1 | -1) {
    const el = this.el;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.transition = '';
      el.style.transform = '';
      this.swipe.emit(dir);
      return;
    }
    const off = el.clientWidth * 0.35;
    el.style.transition = 'transform 120ms ease-in, opacity 120ms ease-in';
    el.style.transform = `translateX(${-dir * off}px)`;
    el.style.opacity = '0';
    setTimeout(() => {
      this.swipe.emit(dir);
      el.style.transition = 'none';
      el.style.transform = `translateX(${dir * off}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 180ms ease-out, opacity 180ms ease-out';
        el.style.transform = '';
        el.style.opacity = '';
      });
    }, 120);
  }
}
