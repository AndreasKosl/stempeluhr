import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Calc, uniMinutes } from '../core/calc';
import { Clock } from '../core/clock';
import { addDays, dateKey, fmtClock, nowMs, startOfMonth, startOfWeek, timeToTs } from '../core/date-utils';
import { TimeEntry } from '../core/models';
import { Tracking } from '../core/tracking';
import { EntryEditor } from '../shared/entry-editor';
import { Icon } from '../shared/icon';
import { DayPipe, DurPipe, HmPipe } from '../shared/pipes';

/** Semester: WiSe 1.10.–31.3., SoSe 1.4.–30.9. */
function semesterOf(k: string) {
  const y = Number(k.slice(0, 4));
  const m = Number(k.slice(5, 7));
  if (m >= 4 && m <= 9) return { label: `SoSe ${y}`, start: `${y}-04-01`, end: `${y}-09-30` };
  const sy = m >= 10 ? y : y - 1;
  return { label: `WiSe ${sy}/${String(sy + 1).slice(2)}`, start: `${sy}-10-01`, end: `${sy + 1}-03-31` };
}

@Component({
  selector: 'app-uni',
  imports: [Icon, DurPipe, HmPipe, DayPipe, FormsModule, EntryEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './uni.html',
  styleUrl: './uni.scss',
})
export class UniPage {
  protected calc = inject(Calc);
  protected track = inject(Tracking);
  private clock = inject(Clock);

  protected subject = signal('');
  protected editing = signal<TimeEntry | null | undefined>(undefined);
  protected limit = signal(30);

  private now = computed(() => (this.calc.runningUni() ? this.clock.now() : nowMs()));
  protected semester = computed(() => semesterOf(this.clock.today()));

  protected subjects = computed(() => {
    const set = new Set(this.calc.uniEntries().filter((e) => e.note).map((e) => e.note!));
    return [...set].sort();
  });

  private sumBetween(a: string, b: string) {
    const from = timeToTs(a, '00:00');
    const to = timeToTs(addDays(b, 1), '00:00');
    return uniMinutes(
      this.calc.uniEntries().filter((e) => e.start >= from && e.start < to),
      this.now(),
    );
  }

  protected stats = computed(() => {
    const today = this.clock.today();
    const sem = this.semester();
    return {
      today: this.sumBetween(today, today),
      week: this.sumBetween(startOfWeek(today), today),
      month: this.sumBetween(startOfMonth(today), today),
      semester: this.sumBetween(sem.start, sem.end),
      total: uniMinutes(this.calc.uniEntries(), this.now()),
    };
  });

  protected liveClock = computed(() => {
    const r = this.calc.runningUni();
    return r ? fmtClock(this.clock.now() - r.start) : '0:00:00';
  });

  /** Aufteilung nach Fach im aktuellen Semester */
  protected bySubject = computed(() => {
    const sem = this.semester();
    const from = timeToTs(sem.start, '00:00');
    const to = timeToTs(addDays(sem.end, 1), '00:00');
    const m = new Map<string, TimeEntry[]>();
    for (const e of this.calc.uniEntries()) {
      if (e.start < from || e.start >= to) continue;
      const k = e.note || 'Ohne Fach';
      (m.get(k) ?? m.set(k, []).get(k)!).push(e);
    }
    const list = [...m.entries()].map(([name, es]) => ({ name, min: uniMinutes(es, this.now()) }));
    list.sort((a, b) => b.min - a.min);
    const max = Math.max(1, ...list.map((x) => x.min));
    return list.map((x) => ({ ...x, pct: (x.min / max) * 100 }));
  });

  protected groups = computed(() => {
    const out: { key: string; total: number; entries: TimeEntry[] }[] = [];
    for (const e of this.calc.uniEntries().slice(0, this.limit())) {
      const k = dateKey(e.start);
      let g = out[out.length - 1];
      if (!g || g.key !== k) out.push((g = { key: k, total: 0, entries: [] }));
      g.entries.push(e);
    }
    for (const g of out) g.total = uniMinutes(g.entries, this.now());
    return out;
  });

  start() {
    this.track.startUni(this.subject().trim());
  }

  minutes(e: TimeEntry) {
    return ((e.end ?? this.now()) - e.start) / 60_000;
  }
}
