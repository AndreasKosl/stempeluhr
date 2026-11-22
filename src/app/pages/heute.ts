import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Calc } from '../core/calc';
import { Clock } from '../core/clock';
import { addDays, eachDay, fmtClock, startOfWeek, timeToTs } from '../core/date-utils';
import { Geo } from '../core/geo';
import { ABSENCE_LABELS, PLACE_LABELS, Place, TimeEntry } from '../core/models';
import { Store } from '../core/store';
import { Tracking } from '../core/tracking';
import { EntryEditor } from '../shared/entry-editor';
import { Icon } from '../shared/icon';
import { DayPipe, DurPipe, HmPipe } from '../shared/pipes';

@Component({
  selector: 'app-heute',
  imports: [Icon, DurPipe, HmPipe, DayPipe, RouterLink, EntryEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './heute.html',
  styleUrl: './heute.scss',
})
export class HeutePage {
  protected calc = inject(Calc);
  protected track = inject(Tracking);
  protected geo = inject(Geo);
  private store = inject(Store);
  private clock = inject(Clock);

  protected readonly placeLabels = PLACE_LABELS;
  protected readonly absenceLabels = ABSENCE_LABELS;
  protected editing = signal<TimeEntry | null | undefined>(undefined);

  protected t = this.calc.today;
  protected settings = computed(() => this.store.data().settings);

  protected status = computed(() => {
    if (this.calc.runningPause()) return 'pause';
    if (this.calc.runningWork()) return 'work';
    return 'idle';
  });

  protected clockText = computed(() => fmtClock(this.t().workedMin * 60_000));

  /** Fortschritt für den Ring (0–1) */
  protected progress = computed(() => {
    const t = this.t();
    const target = t.targetMin || t.plannedMin;
    return target > 0 ? Math.min(1, t.workedMin / target) : t.workedMin > 0 ? 1 : 0;
  });
  protected readonly R = 104;
  protected readonly C = 2 * Math.PI * 104;
  protected dash = computed(() => `${this.C * this.progress()} ${this.C}`);

  protected remaining = computed(() => Math.max(0, this.t().targetMin - this.t().workedMin));

  /** Voraussichtliches Arbeitsende inkl. noch bevorstehender eingetragener Pausen */
  protected endEstimate = computed(() => {
    if (!this.calc.runningWork() || this.calc.runningPause()) return null;
    const now = this.clock.now();
    const rem = this.remaining();
    if (rem <= 0) return null;
    let end = now + rem * 60_000;
    for (const e of this.t().entries) {
      if (e.kind === 'pause' && e.end && e.end > now && e.start < end) end += e.end - Math.max(e.start, now);
    }
    return end;
  });

  protected lunchDone = computed(() => {
    const s = this.settings();
    const a = timeToTs(this.t().key, s.lunchStart);
    const b = timeToTs(this.t().key, s.lunchEnd);
    return this.t().entries.some((e) => e.kind === 'pause' && e.start < b && (e.end ?? Date.now()) > a);
  });

  protected currentPlace = computed<Place | null>(() => this.calc.runningWork()?.place ?? this.t().place);

  protected week = computed(() => {
    const today = this.t().key;
    const start = startOfWeek(today);
    const days = eachDay(start, addDays(start, 6)).map((k) => (k === today ? this.t() : this.calc.day(k)));
    const max = Math.max(...days.map((d) => Math.max(d.workedMin, d.plannedMin)), 60);
    const worked = days.reduce((s, d) => s + d.workedMin, 0);
    const target = days.reduce((s, d) => s + d.targetMin, 0);
    const diff = days.filter((d) => !d.isFuture).reduce((s, d) => s + d.diffMin, 0);
    return { days, max, worked, target, diff };
  });

  protected entries = computed(() => [...this.t().entries].sort((a, b) => a.start - b.start));

  entryMin(e: TimeEntry): number {
    return ((e.end ?? this.clock.now()) - e.start) / 60_000;
  }

  togglePlace() {
    const w = this.calc.runningWork();
    if (!w) return;
    const next: Place = w.place === 'buero' ? 'homeoffice' : 'buero';
    this.store.updateEntry(w.id, { place: next, placeAuto: false });
  }

  relocate() {
    const w = this.calc.runningWork();
    if (w) this.track.tagPlace(w.id);
  }
}
