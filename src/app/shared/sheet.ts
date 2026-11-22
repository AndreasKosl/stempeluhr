import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Modales Bottom-Sheet im Material-3-Stil */
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scrim" (click)="closed.emit()"></div>
    <section class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="title()">
      <div class="handle"></div>
      <h2>{{ title() }}</h2>
      <div class="body"><ng-content /></div>
      <div class="actions"><ng-content select="[actions]" /></div>
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .scrim {
      position: absolute;
      inset: 0;
      background: var(--scrim);
      animation: fade 0.2s;
    }
    .sheet {
      position: relative;
      width: 100%;
      max-width: 640px;
      max-height: 92dvh;
      overflow-y: auto;
      background: var(--surface-low);
      border-radius: 28px 28px 0 0;
      padding: 8px 20px calc(env(safe-area-inset-bottom) + 16px);
      animation: up 0.25s cubic-bezier(0.2, 0, 0, 1);
    }
    .handle {
      width: 32px;
      height: 4px;
      border-radius: 2px;
      background: var(--outline);
      margin: 8px auto 16px;
      opacity: 0.6;
    }
    h2 {
      margin: 0 0 16px;
      font-size: 22px;
      font-weight: 400;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      align-items: center;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    @keyframes up {
      from {
        transform: translateY(100%);
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  `,
})
export class Sheet {
  readonly title = input('');
  readonly closed = output();
}
