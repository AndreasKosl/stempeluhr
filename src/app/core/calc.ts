import { Injectable, computed, inject } from '@angular/core';
import { Clock } from './clock';
import { addDays, currentYear, dateKey, eachDay, hoursToMin, MINUTE, nowMs, weekdayIdx } from './date-utils';
import { holidaysFor } from './holidays';
import { ABSENCE_CREDITS, Absence, AbsenceType, Place, TimeEntry, WorkPlan } from './models';
import { Store } from './store';

export interface DayInfo {
  key: string;
  /** Soll laut Arbeitsplan */
  plannedMin: number;
  /** Soll nach Abzug von Feiertagen/Abwesenheiten */
  targetMin: number;
  workedMin: number;
  pauseMin: number;
  diffMin: number;
  holiday?: string;
  absence?: Absence;
  absenceType?: AbsenceType;
  place: Place | null;
  first?: number;
  last?: number;
  entries: TimeEntry[];
  running: boolean;
  isFuture: boolean;
}

type Interval = [number, number];

function merge(list: Interval[]): Interval[] {
  const s = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const iv of s) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

const total = (l: Interval[]) => l.reduce((s, [a, b]) => s + (b - a), 0);

function overlap(a: Interval[], b: Interval[]): number {
  let sum = 0;
  for (const [s1, e1] of a) for (const [s2, e2] of b) sum += Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
  return sum;
}

/** Netto-Arbeitszeit: Vereinigung der Arbeitsintervalle minus überlappende Pausen. */
export function netWork(entries: TimeEntry[], now: number): { worked: number; pause: number } {
  const work = merge(entries.filter((e) => e.kind === 'work').map((e) => [e.start, e.end ?? now] as Interval));
  const pauses = merge(entries.filter((e) => e.kind === 'pause').map((e) => [e.start, e.end ?? now] as Interval));
  // Nur Pausen, die eine Arbeitsphase überlappen, reduzieren die Arbeitszeit.
  // (Im Import-Format liegen Pausen in Lücken zwischen Arbeitsblöcken – auch das passt.)
  const ov = overlap(work, pauses);
  const pastPauses = merge(pauses.map(([a, b]) => [a, Math.min(b, now)] as Interval));
  return { worked: (total(work) - ov) / MINUTE, pause: total(pastPauses) / MINUTE };
}

export function uniMinutes(entries: TimeEntry[], now: number): number {
  return total(merge(entries.map((e) => [e.start, e.end ?? now] as Interval))) / MINUTE;
}

@Injectable({ providedIn: 'root' })
export class Calc {
  private store = inject(Store);
  private clock = inject(Clock);

  readonly settings = computed(() => this.store.data().settings);

  readonly plans = computed(() => [...this.store.data().plans].sort((a, b) => a.validFrom.localeCompare(b.validFrom)));

  /** Erster Tag, ab dem Soll/Überstunden gerechnet werden */
  readonly trackingStart = computed(() => this.plans()[0]?.validFrom ?? null);

  readonly workByDay = computed(() => {
    const m = new Map<string, TimeEntry[]>();
    for (const e of this.store.data().entries) {
      if (e.kind === 'uni') continue;
      const k = dateKey(e.start);
      (m.get(k) ?? m.set(k, []).get(k)!).push(e);
    }
    for (const l of m.values()) l.sort((a, b) => a.start - b.start);
    return m;
  });

  readonly uniEntries = computed(() =>
    this.store
      .data()
      .entries.filter((e) => e.kind === 'uni')
      .sort((a, b) => b.start - a.start),
  );

  readonly runningWork = computed(() => this.store.data().entries.find((e) => e.kind === 'work' && e.end === null) ?? null);
  readonly runningPause = computed(() => this.store.data().entries.find((e) => e.kind === 'pause' && e.end === null) ?? null);
  readonly runningUni = computed(() => this.store.data().entries.find((e) => e.kind === 'uni' && e.end === null) ?? null);

  private readonly yearRange = computed(() => {
    const now = currentYear();
    const d = this.store.data();
    let first = now - 1;
    const ts = this.trackingStart();
    if (ts) first = Math.min(first, Number(ts.slice(0, 4)));
    for (const a of d.absences) first = Math.min(first, Number(a.start.slice(0, 4)));
    return [first, now + 2] as const;
  });

  /** Gesetzliche Feiertage + manuell eingetragene Feiertage */
  readonly holidays = computed(() => {
    const [from, to] = this.yearRange();
    const state = this.settings().state;
    const m = new Map<string, string>();
    for (let y = from; y <= to; y++) for (const [k, v] of holidaysFor(y, state)) m.set(k, v);
    for (const a of this.store.data().absences) {
      if (a.type !== 'feiertag') continue;
      for (const k of eachDay(a.start, a.end)) m.set(k, a.note || 'Feiertag');
    }
    return m;
  });

  /** Nur gesetzliche Feiertage (für Listenanzeige) */
  readonly legalHolidays = computed(() => {
    const [from, to] = this.yearRange();
    const out: { key: string; name: string }[] = [];
    for (let y = from; y <= to; y++) for (const [k, v] of holidaysFor(y, this.settings().state)) out.push({ key: k, name: v });
    return out;
  });

  readonly absenceByDay = computed(() => {
    const m = new Map<string, Absence>();
    for (const a of this.store.data().absences) {
      if (a.type === 'feiertag') continue;
      for (const k of eachDay(a.start, a.end)) m.set(k, a);
    }
    return m;
  });

  planFor(key: string, plans: WorkPlan[] = this.plans()): WorkPlan | null {
    let found: WorkPlan | null = null;
    for (const p of plans) if (p.validFrom <= key) found = p;
    return found;
  }

  plannedMin(key: string): number {
    const p = this.planFor(key);
    return p ? hoursToMin(p.hours[weekdayIdx(key)] ?? 0) : 0;
  }

  day(key: string, now = nowMs()): DayInfo {
    const entries = this.workByDay().get(key) ?? [];
    const plannedMin = this.plannedMin(key);
    const holiday = this.holidays().get(key);
    const absence = this.absenceByDay().get(key);
    let targetMin = plannedMin;
    let absenceType: AbsenceType | undefined;
    if (holiday) {
      targetMin = 0;
      absenceType = 'feiertag';
    } else if (absence) {
      absenceType = absence.type;
      if (ABSENCE_CREDITS[absence.type]) targetMin = absence.halfDay ? plannedMin / 2 : 0;
    }
    const { worked, pause } = netWork(entries, now);
    const placeMs: Record<Place, number> = { buero: 0, homeoffice: 0 };
    for (const e of entries) if (e.kind === 'work' && e.place) placeMs[e.place] += (e.end ?? now) - e.start;
    const place: Place | null =
      placeMs.buero + placeMs.homeoffice === 0 ? null : placeMs.buero >= placeMs.homeoffice ? 'buero' : 'homeoffice';
    const work = entries.filter((e) => e.kind === 'work');
    return {
      key,
      plannedMin,
      targetMin,
      workedMin: worked,
      pauseMin: pause,
      diffMin: worked - targetMin,
      holiday,
      absence,
      absenceType,
      place,
      first: work.length ? Math.min(...work.map((e) => e.start)) : undefined,
      last: work.length && work.every((e) => e.end) ? Math.max(...work.map((e) => e.end!)) : undefined,
      entries,
      running: work.some((e) => e.end === null),
      isFuture: key > this.clock.today(),
    };
  }

  /** Summe der Tagesdifferenzen ab Trackingbeginn bis einschließlich `to` (ohne Korrekturen) */
  private diffUntil(to: string): number {
    const start = this.trackingStart();
    if (!start) return 0;
    let sum = 0;
    for (let k = start; k <= to; k = addDays(k, 1)) sum += this.day(k).diffMin;
    return sum;
  }

  private adjustmentsUntil(to: string): number {
    return this.store
      .data()
      .adjustments.filter((a) => a.date <= to)
      .reduce((s, a) => s + a.minutes, 0);
  }

  /** Überstunden bis einschließlich gestern (ohne Korrekturen) */
  private readonly balanceUntilYesterday = computed(() => this.diffUntil(addDays(this.clock.today(), -1)));

  readonly adjustmentsTotal = computed(() => this.adjustmentsUntil(this.clock.today()));

  /** Überstundensaldo bis gestern inkl. Korrekturen */
  readonly overtime = computed(() => this.balanceUntilYesterday() + this.adjustmentsTotal());

  /**
   * Saldo am Ende des Tages `key` inkl. Korrekturen.
   * Für heute oder spätere Tage: aktueller Live-Saldo.
   */
  balanceAt(key: string): number {
    if (key >= this.clock.today()) return this.overtimeLive();
    return this.diffUntil(key) + this.adjustmentsUntil(key);
  }

  /** Live-Werte für heute */
  readonly today = computed(() => this.day(this.clock.today(), this.clock.now()));

  /** Saldo inklusive heutigem Stand */
  readonly overtimeLive = computed(() => {
    const t = this.today();
    const counts = this.trackingStart() && t.key >= this.trackingStart()!;
    return this.overtime() + (counts ? t.diffMin : 0);
  });

  /** Summen über einen Zeitraum */
  range(a: string, b: string, now = nowMs()) {
    const today = this.clock.today();
    const start = this.trackingStart();
    let worked = 0;
    let target = 0;
    let diff = 0;
    let planned = 0;
    let ho = 0;
    let buero = 0;
    const days: DayInfo[] = [];
    for (const k of eachDay(a, b)) {
      const d = this.day(k, now);
      days.push(d);
      worked += d.workedMin;
      planned += d.plannedMin;
      target += d.targetMin;
      if (k <= today && start && k >= start) diff += d.diffMin;
      if (d.place === 'homeoffice') ho++;
      if (d.place === 'buero') buero++;
    }
    return { days, worked, target, planned, diff, ho, buero };
  }

  /** Arbeitstage einer Abwesenheit (nur Soll-Tage, ohne Feiertage) */
  absenceWorkdays(a: Absence, year?: number): number {
    let n = 0;
    for (const k of eachDay(a.start, a.end)) {
      if (year && Number(k.slice(0, 4)) !== year) continue;
      if (this.plannedMin(k) > 0 && (a.type === 'feiertag' || !this.holidays().has(k))) n += a.halfDay ? 0.5 : 1;
    }
    return n;
  }

  /** Abwesenheitstage eines Typs in einem Jahr, getrennt nach vergangen/geplant */
  absenceDays(type: AbsenceType, year: number) {
    const today = this.clock.today();
    let taken = 0;
    let planned = 0;
    for (const a of this.store.data().absences) {
      if (a.type !== type) continue;
      for (const k of eachDay(a.start, a.end)) {
        if (Number(k.slice(0, 4)) !== year) continue;
        if (this.plannedMin(k) <= 0 || (type !== 'feiertag' && this.holidays().has(k))) continue;
        const v = a.halfDay ? 0.5 : 1;
        if (k <= today) taken += v;
        else planned += v;
      }
    }
    return { taken, planned };
  }

  /** Urlaubskonto mit optionalem Übertrag aus dem Vorjahr */
  vacation(year: number) {
    const s = this.settings();
    const startYear = Number((this.trackingStart() ?? this.clock.today()).slice(0, 4));
    let carry = 0;
    let result = { year, entitlement: s.vacationDaysPerYear, carry: 0, taken: 0, planned: 0, remaining: s.vacationDaysPerYear };
    for (let y = Math.min(startYear, year); y <= year; y++) {
      const { taken, planned } = this.absenceDays('urlaub', y);
      const entitlement = s.vacationDaysPerYear + carry;
      const remaining = entitlement - taken - planned;
      result = { year: y, entitlement, carry, taken, planned, remaining };
      carry = s.vacationCarryOver ? remaining : 0;
    }
    return result;
  }
}
