import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Calc } from '../core/calc';
import { Clock } from '../core/clock';
import { addDays } from '../core/date-utils';
import { ABSENCE_LABELS, Absence, EntryKind, PLACE_LABELS, Place, TimeEntry } from '../core/models';
import { Store } from '../core/store';
import { Tracking } from '../core/tracking';
import { AbsenceEditor } from '../shared/absence-editor';
import { EntryEditor } from '../shared/entry-editor';
import { Icon } from '../shared/icon';
import { DayPipe, DurPipe, HmPipe } from '../shared/pipes';

@Component({
  selector: 'app-tag',
  imports: [Icon, DurPipe, HmPipe, DayPipe, EntryEditor, AbsenceEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <button class="icon-btn" type="button" (click)="back()" aria-label="Zurück"><app-icon name="back" /></button>
      <h1>{{ key() | day: 'long' }}<span class="sub">{{ key() | day }}</span></h1>
      <button class="icon-btn" type="button" (click)="go(-1)" aria-label="Vorheriger Tag"><app-icon name="chevron_left" /></button>
      <button class="icon-btn" type="button" (click)="go(1)" aria-label="Nächster Tag"><app-icon name="chevron_right" /></button>
    </header>

    <div class="content">
      <section class="card primary">
        <div class="stats four">
          <div class="stat"><span class="label">Ist</span><span class="value">{{ d().workedMin | dur }}</span></div>
          <div class="stat"><span class="label">Soll</span><span class="value">{{ d().targetMin | dur }}</span></div>
          <div class="stat"><span class="label">Pause</span><span class="value">{{ d().pauseMin | dur }}</span></div>
          <div class="stat">
            <span class="label">Diff</span>
            <span class="value">{{ d().isFuture ? '–' : (d().diffMin | dur: true) }}</span>
          </div>
        </div>
        @if (warning()) {
          <p class="warn"><app-icon name="warning" [size]="16" /> {{ warning() }}</p>
        }
      </section>

      @if (d().holiday) {
        <div class="card row nowrap">
          <span class="avatar feiertag"><app-icon name="star" [size]="20" /></span>
          <span class="grow">{{ d().holiday }}</span>
          @if (holidayAbsence(); as ha) {
            <button class="btn text" type="button" (click)="absenceEditing.set(ha)">Bearbeiten</button>
          }
        </div>
      } @else if (d().absence; as a) {
        <button class="card row nowrap absence" type="button" (click)="absenceEditing.set(a)">
          <span class="avatar" [class]="a.type"><app-icon name="event" [size]="20" /></span>
          <span class="grow">
            {{ absenceLabels[a.type] }}{{ a.halfDay ? ' (halber Tag)' : '' }}
            <span class="muted-text block">{{ a.start | day }}{{ a.end !== a.start ? ' – ' + (a.end | day) : '' }}{{ a.note ? ' · ' + a.note : '' }}</span>
          </span>
          <app-icon name="edit" [size]="20" />
        </button>
      } @else {
        <button class="btn tonal" type="button" (click)="absenceEditing.set(null)">
          <app-icon name="event" [size]="18" /> Abwesenheit eintragen
        </button>
      }

      <h3 class="section-title">Arbeitsort</h3>
      <div class="segmented">
        <button type="button" [class.on]="d().place === 'buero'" (click)="setPlace('buero')" [disabled]="!hasWork()">
          <app-icon name="office" [size]="18" /> Büro
        </button>
        <button type="button" [class.on]="d().place === 'homeoffice'" (click)="setPlace('homeoffice')" [disabled]="!hasWork()">
          <app-icon name="home" [size]="18" /> Homeoffice
        </button>
      </div>

      <h3 class="section-title">Einträge</h3>
      @if (d().entries.length) {
        <div class="list">
          @for (e of d().entries; track e.id) {
            <button class="list-item" type="button" (click)="open(e)">
              <span class="avatar" [class]="e.kind">
                <app-icon [name]="e.kind === 'pause' ? 'lunch' : e.place === 'buero' ? 'office' : 'home'" [size]="20" />
              </span>
              <span class="main">
                <span class="title num">{{ e.start | hm }} – {{ e.end ? (e.end | hm) : 'läuft' }}</span>
                <span class="supporting">
                  {{ e.kind === 'pause' ? 'Pause' : e.place ? placeLabels[e.place] : 'Arbeit' }}{{ e.placeAuto ? ' (GPS)' : '' }}{{ e.note ? ' · ' + e.note : '' }}
                </span>
              </span>
              <span class="trailing num">{{ minutes(e) | dur }}</span>
            </button>
          }
        </div>
      } @else {
        <p class="empty">Keine Einträge an diesem Tag.</p>
      }

      <div class="row">
        <button class="btn tonal grow" type="button" (click)="add('work')"><app-icon name="add" [size]="18" /> Arbeitszeit</button>
        <button class="btn tonal grow" type="button" (click)="add('pause')"><app-icon name="add" [size]="18" /> Pause</button>
      </div>
      <button class="btn outlined block" type="button" (click)="track.addLunch(key())">
        <app-icon name="lunch" [size]="18" /> Pause {{ settings().lunchStart }}–{{ settings().lunchEnd }} eintragen
      </button>
    </div>

    @if (editing() !== undefined) {
      <app-entry-editor [entry]="editing() ?? null" [day]="key()" [defaultKind]="newKind()" (closed)="editing.set(undefined)" />
    }
    @if (absenceEditing() !== undefined) {
      <app-absence-editor [absence]="absenceEditing() ?? null" [initialDate]="key()" (closed)="absenceEditing.set(undefined)" />
    }
  `,
  styles: `
    .warn {
      display: flex;
      gap: 6px;
      align-items: center;
      margin: 12px 0 0;
      font-size: 13px;
    }
    .absence {
      border: 0;
      text-align: left;
      color: inherit;
      cursor: pointer;
      font-size: 16px;
    }
    .block {
      display: block;
    }
  `,
})
export class TagPage {
  private calc = inject(Calc);
  private clock = inject(Clock);
  private store = inject(Store);
  private router = inject(Router);
  protected track = inject(Tracking);

  readonly key = input.required<string>();
  protected readonly absenceLabels = ABSENCE_LABELS;
  protected readonly placeLabels = PLACE_LABELS;

  protected editing = signal<TimeEntry | null | undefined>(undefined);
  protected newKind = signal<EntryKind>('work');
  protected absenceEditing = signal<Absence | null | undefined>(undefined);

  protected settings = computed(() => this.store.data().settings);
  protected d = computed(() => {
    const k = this.key();
    const running = k === this.clock.today() && !!this.calc.runningWork();
    return this.calc.day(k, running ? this.clock.now() : Date.now());
  });
  protected hasWork = computed(() => this.d().entries.some((e) => e.kind === 'work'));
  protected holidayAbsence = computed(
    () => this.store.data().absences.find((a) => a.type === 'feiertag' && a.start <= this.key() && a.end >= this.key()) ?? null,
  );

  /** Hinweis auf gesetzliche Pausen (ArbZG §4) */
  protected warning = computed(() => {
    const d = this.d();
    if (d.workedMin > 9 * 60 && d.pauseMin < 45) return 'Ab 9 h Arbeit sind 45 min Pause vorgeschrieben.';
    if (d.workedMin > 6 * 60 && d.pauseMin < 30) return 'Ab 6 h Arbeit sind 30 min Pause vorgeschrieben.';
    if (d.workedMin > 10 * 60) return 'Mehr als 10 h Arbeitszeit.';
    return '';
  });

  minutes(e: TimeEntry) {
    return ((e.end ?? this.clock.now()) - e.start) / 60_000;
  }

  open(e: TimeEntry) {
    this.editing.set(e);
  }

  add(kind: EntryKind) {
    this.newKind.set(kind);
    this.editing.set(null);
  }

  setPlace(p: Place) {
    for (const e of this.d().entries) if (e.kind === 'work') this.store.updateEntry(e.id, { place: p, placeAuto: false });
  }

  go(n: number) {
    this.router.navigate(['/tag', addDays(this.key(), n)], { replaceUrl: true });
  }

  back() {
    if (history.length > 1) history.back();
    else this.router.navigate(['/uebersicht']);
  }

}
