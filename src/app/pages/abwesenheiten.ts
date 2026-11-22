import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Calc } from '../core/calc';
import { Clock } from '../core/clock';
import { GoogleCalendarSync, buildIcs, googleCalendarLink, shareOrDownload } from '../core/calendar';
import { fmtRange } from '../core/date-utils';
import { ABSENCE_ICONS, ABSENCE_LABELS, Absence } from '../core/models';
import { Store } from '../core/store';
import { Ui } from '../core/ui';
import { AbsenceEditor } from '../shared/absence-editor';
import { Icon } from '../shared/icon';
import { NumPipe } from '../shared/pipes';
import { Sheet } from '../shared/sheet';

interface Row {
  id: string;
  absence?: Absence;
  type: Absence['type'];
  title: string;
  range: string;
  days: number;
  note?: string;
  start: string;
  past: boolean;
  synced: boolean;
}

@Component({
  selector: 'app-abwesenheiten',
  imports: [Icon, NumPipe, AbsenceEditor, Sheet, RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './abwesenheiten.html',
  styles: `
    .vac .big {
      font-size: 40px;
      line-height: 1;
      font-weight: 400;
    }
    .vac .progress {
      margin: 12px 0 8px;
      background: rgb(255 255 255 / 0.45);
    }
    .vac .progress .planned {
      background: var(--tertiary);
      opacity: 0.45;
    }
    .vac .progress > .bar2 {
      display: flex;
      height: 100%;
      background: none;
    }
    .cal-btn {
      color: var(--primary);
    }
    .synced {
      color: var(--positive);
    }
    .sheet-text {
      margin: 0;
      font-size: 14px;
      color: var(--on-surface-variant);
    }
  `,
})
export class AbwesenheitenPage {
  protected calc = inject(Calc);
  private clock = inject(Clock);
  private store = inject(Store);
  private ui = inject(Ui);
  protected gsync = inject(GoogleCalendarSync);

  protected readonly labels = ABSENCE_LABELS;
  protected readonly icons = ABSENCE_ICONS;

  protected year = signal(Number(this.clock.today().slice(0, 4)));
  protected showHolidays = signal(false);
  protected editing = signal<Absence | null | undefined>(undefined);
  protected calendarSheet = signal(false);

  protected settings = computed(() => this.store.data().settings);
  protected vac = computed(() => this.calc.vacation(this.year()));
  protected other = computed(() => ({
    krank: this.calc.absenceDays('krank', this.year()),
    sonder: this.calc.absenceDays('sonderurlaub', this.year()),
    abbau: this.calc.absenceDays('abbau', this.year()),
  }));

  protected rows = computed<Row[]>(() => {
    const y = String(this.year());
    const today = this.clock.today();
    const rows: Row[] = this.store
      .data()
      .absences.filter((a) => a.start.startsWith(y) || a.end.startsWith(y))
      .filter((a) => a.type !== 'feiertag' || this.showHolidays())
      .map((a) => ({
        id: a.id,
        absence: a,
        type: a.type,
        title: (a.type === 'feiertag' && a.note ? a.note : ABSENCE_LABELS[a.type]) + (a.halfDay ? ' (½ Tag)' : ''),
        range: fmtRange(a.start, a.end),
        days: this.calc.absenceWorkdays(a, this.year()),
        note: a.type === 'feiertag' ? undefined : a.note,
        start: a.start,
        past: a.end < today,
        synced:
          (!!a.googleEventId && (a.googleSyncedAt ?? 0) >= a.updatedAt) || (a.calendarAddedAt ?? 0) >= a.updatedAt,
      }));
    if (this.showHolidays()) {
      for (const h of this.calc.legalHolidays()) {
        if (!h.key.startsWith(y)) continue;
        rows.push({
          id: 'h' + h.key,
          type: 'feiertag',
          title: h.name,
          range: fmtRange(h.key, h.key),
          days: this.calc.plannedMin(h.key) > 0 ? 1 : 0,
          start: h.key,
          past: h.key < today,
          synced: false,
        });
      }
    }
    return rows.sort((a, b) => a.start.localeCompare(b.start));
  });

  protected upcoming = computed(() => this.rows().filter((r) => !r.past));
  protected past = computed(() => this.rows().filter((r) => r.past).reverse());

  iconOf(t: Absence["type"]) {
    return ABSENCE_ICONS[t];
  }

  link(a: Absence) {
    return googleCalendarLink(a);
  }

  markAdded(a: Absence) {
    this.store.markCalendarAdded(a.id);
  }

  vacPct(v: number) {
    const e = this.vac().entitlement;
    return e > 0 ? Math.min(100, (v / e) * 100) : 0;
  }

  private exportable(onlyFuture: boolean) {
    const today = this.clock.today();
    return this.store
      .data()
      .absences.filter((a) => a.type !== 'feiertag' || this.settings().calendarIncludeHolidays)
      .filter((a) => !onlyFuture || a.end >= today);
  }

  async exportIcs(onlyFuture: boolean) {
    const list = this.exportable(onlyFuture);
    if (!list.length) {
      this.ui.show('Keine Abwesenheiten zum Exportieren');
      return;
    }
    try {
      const r = await shareOrDownload(buildIcs(list), 'abwesenheiten.ics', 'text/calendar');
      this.ui.show(r === 'shared' ? `${list.length} Termine geteilt` : `${list.length} Termine als .ics gespeichert`);
      this.calendarSheet.set(false);
    } catch {
      /* abgebrochen */
    }
  }

  async syncGoogle() {
    try {
      const r = await this.gsync.sync();
      this.ui.show(`Kalender synchronisiert: ${r.created} neu, ${r.updated} aktualisiert, ${r.deleted} gelöscht`, undefined, 6000);
      this.calendarSheet.set(false);
    } catch (e) {
      this.ui.show((e as Error).message, undefined, 6000);
    }
  }
}
