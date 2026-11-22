import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Calc, DayInfo } from '../core/calc';
import { Clock } from '../core/clock';
import { addDays, addMonths, endOfMonth, fmtDate, fmtMonth, fmtMonthShort, isoWeek, nowMs, startOfMonth, startOfWeek } from '../core/date-utils';
import { ABSENCE_LABELS } from '../core/models';
import { Icon } from '../shared/icon';
import { DayPipe, DurPipe, HmPipe, NumPipe } from '../shared/pipes';

type Mode = 'woche' | 'monat' | 'jahr';

interface WeekGroup {
  kw: number;
  days: DayInfo[];
  worked: number;
  diff: number;
}

const MODE_KEY = 'stempeluhr.uebersicht.mode';

@Component({
  selector: 'app-uebersicht',
  imports: [Icon, DurPipe, HmPipe, DayPipe, NumPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './uebersicht.html',
  styleUrl: './uebersicht.scss',
})
export class UebersichtPage {
  protected calc = inject(Calc);
  private clock = inject(Clock);
  protected readonly absenceLabels = ABSENCE_LABELS;

  protected mode = signal<Mode>((sessionStorage.getItem(MODE_KEY) as Mode) || 'woche');
  protected anchor = signal(this.clock.today());

  protected bounds = computed(() => {
    const a = this.anchor();
    switch (this.mode()) {
      case 'woche': {
        const s = startOfWeek(a);
        return [s, addDays(s, 6)] as const;
      }
      case 'monat':
        return [startOfMonth(a), endOfMonth(a)] as const;
      default:
        return [`${a.slice(0, 4)}-01-01`, `${a.slice(0, 4)}-12-31`] as const;
    }
  });

  protected title = computed(() => {
    const [a, b] = this.bounds();
    switch (this.mode()) {
      case 'woche':
        return `KW ${isoWeek(a)} · ${fmtDate(a).slice(0, 6)} – ${fmtDate(b).slice(0, 6)}`;
      case 'monat':
        return fmtMonth(a);
      default:
        return a.slice(0, 4);
    }
  });

  protected summary = computed(() => {
    // Nur bei laufendem Timer sekündlich neu berechnen
    const now = this.calc.runningWork() ? this.clock.now() : nowMs();
    const [a, b] = this.bounds();
    return this.calc.range(a, b, now);
  });

  protected weeks = computed<WeekGroup[]>(() => {
    const groups: WeekGroup[] = [];
    for (const d of this.summary().days) {
      const kw = isoWeek(d.key);
      let g = groups[groups.length - 1];
      if (!g || g.kw !== kw) groups.push((g = { kw, days: [], worked: 0, diff: 0 }));
      g.days.push(d);
      g.worked += d.workedMin;
      if (!d.isFuture) g.diff += d.diffMin;
    }
    return groups;
  });

  protected months = computed(() => {
    const year = this.anchor().slice(0, 4);
    const out: { key: string; label: string; worked: number; target: number; diff: number; ho: number; buero: number }[] = [];
    const today = this.clock.today();
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}-01`;
      if (key > today) break;
      const days = this.summary().days.filter((d) => d.key.startsWith(key.slice(0, 7)));
      const start = this.calc.trackingStart();
      out.push({
        key,
        label: fmtMonthShort(key),
        worked: days.reduce((s, d) => s + d.workedMin, 0),
        target: days.reduce((s, d) => s + d.targetMin, 0),
        diff: days.filter((d) => !d.isFuture && start && d.key >= start).reduce((s, d) => s + d.diffMin, 0),
        ho: days.filter((d) => d.place === 'homeoffice').length,
        buero: days.filter((d) => d.place === 'buero').length,
      });
    }
    return out.reverse();
  });

  protected yearAbsences = computed(() => {
    const y = Number(this.anchor().slice(0, 4));
    return {
      urlaub: this.calc.absenceDays('urlaub', y),
      krank: this.calc.absenceDays('krank', y),
      sonder: this.calc.absenceDays('sonderurlaub', y),
      abbau: this.calc.absenceDays('abbau', y),
    };
  });

  setMode(m: Mode) {
    this.mode.set(m);
    sessionStorage.setItem(MODE_KEY, m);
  }

  move(dir: number) {
    const a = this.anchor();
    switch (this.mode()) {
      case 'woche':
        this.anchor.set(addDays(a, 7 * dir));
        break;
      case 'monat':
        this.anchor.set(addMonths(a, dir));
        break;
      default:
        this.anchor.set(`${Number(a.slice(0, 4)) + dir}-01-01`);
    }
  }

  openMonth(key: string) {
    this.anchor.set(key);
    this.setMode('monat');
  }

  isOff(d: DayInfo) {
    return d.plannedMin === 0 && d.workedMin === 0 && !d.absenceType;
  }
}
