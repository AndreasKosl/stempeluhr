import { Injectable, signal } from '@angular/core';
import { nowMs, todayKey } from './date-utils';

/** Tickt jede Sekunde – Grundlage für Live-Zeiten. */
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(nowMs());
  readonly today = signal(todayKey());

  constructor() {
    setInterval(() => this.tick(), 1000);
    document.addEventListener('visibilitychange', () => this.tick());
  }

  private tick() {
    this.now.set(nowMs());
    const t = todayKey();
    if (t !== this.today()) this.today.set(t);
  }
}
