import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Calc } from '../core/calc';
import { googleCalendarLink } from '../core/calendar';
import { todayKey } from '../core/date-utils';
import { ABSENCE_ICONS, ABSENCE_LABELS, Absence, AbsenceType } from '../core/models';
import { Store } from '../core/store';
import { Ui } from '../core/ui';
import { Icon } from './icon';
import { NumPipe } from './pipes';
import { Sheet } from './sheet';

@Component({
  selector: 'app-absence-editor',
  imports: [Sheet, FormsModule, Icon, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sheet [title]="absence() ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen'" (closed)="closed.emit()">
      <div class="chips">
        @for (t of types; track t) {
          <button type="button" class="chip" [class.on]="type() === t" (click)="type.set(t)">
            <app-icon [name]="icons[t]" [size]="18" /> {{ labels[t] }}
          </button>
        }
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="ae-from">Von</label>
          <input id="ae-from" type="date" [ngModel]="start()" (ngModelChange)="setStart($event)" />
        </div>
        <div class="field">
          <label for="ae-to">Bis</label>
          <input id="ae-to" type="date" [(ngModel)]="end" [min]="start()" />
        </div>
      </div>
      @if (start() === end()) {
        <label class="switch-row">
          <span class="main"><span>Halber Tag</span></span>
          <input type="checkbox" [(ngModel)]="halfDay" />
        </label>
      }
      <div class="field">
        <label for="ae-note">{{ type() === 'feiertag' ? 'Name' : 'Notiz' }}</label>
        <input id="ae-note" type="text" [(ngModel)]="note" [placeholder]="type() === 'feiertag' ? 'z. B. Heiligabend' : ''" />
      </div>
      <p class="muted-text">
        {{ workdays() | num }} Arbeitstag{{ workdays() === 1 ? '' : 'e' }}
        @if (type() === 'urlaub') {
          · Feiertage und freie Tage werden nicht abgezogen
        }
        @if (type() === 'abbau') {
          · Sollzeit bleibt bestehen und wird vom Überstundenkonto abgezogen
        }
      </p>
      <ng-container actions>
        @if (absence(); as a) {
          <button class="btn text" type="button" (click)="remove()"><app-icon name="delete" [size]="18" /></button>
          <a class="btn text" [href]="calLink()" target="_blank" rel="noopener"><app-icon name="calendar_add" [size]="18" /> Kalender</a>
        }
        <span class="spacer"></span>
        <button class="btn text" type="button" (click)="closed.emit()">Abbrechen</button>
        <button class="btn" type="button" (click)="save()">Speichern</button>
      </ng-container>
    </app-sheet>
  `,
})
export class AbsenceEditor implements OnInit {
  private store = inject(Store);
  private calc = inject(Calc);
  private ui = inject(Ui);

  readonly absence = input<Absence | null>(null);
  readonly initialDate = input<string>(todayKey());
  readonly initialType = input<AbsenceType>('urlaub');
  readonly closed = output();

  protected readonly types: AbsenceType[] = ['urlaub', 'krank', 'sonderurlaub', 'feiertag', 'abbau'];
  protected readonly labels = ABSENCE_LABELS;
  protected readonly icons = ABSENCE_ICONS;

  protected type = signal<AbsenceType>('urlaub');
  protected start = signal('');
  protected end = signal('');
  protected halfDay = signal(false);
  protected note = signal('');

  protected workdays = computed(() => {
    if (!this.start() || !this.end() || this.end() < this.start()) return 0;
    return this.calc.absenceWorkdays({
      id: '',
      type: this.type(),
      start: this.start(),
      end: this.end(),
      halfDay: this.start() === this.end() && this.halfDay(),
      updatedAt: 0,
    });
  });

  protected calLink = computed(() => {
    const a = this.absence();
    return a ? googleCalendarLink(a) : '';
  });

  ngOnInit() {
    const a = this.absence();
    if (a) {
      this.type.set(a.type);
      this.start.set(a.start);
      this.end.set(a.end);
      this.halfDay.set(!!a.halfDay);
      this.note.set(a.note ?? '');
    } else {
      this.type.set(this.initialType());
      this.start.set(this.initialDate());
      this.end.set(this.initialDate());
    }
  }

  setStart(v: string) {
    this.start.set(v);
    if (!this.end() || this.end() < v) this.end.set(v);
  }

  save() {
    if (!this.start() || !this.end() || this.end() < this.start()) {
      this.ui.show('Bitte einen gültigen Zeitraum wählen');
      return;
    }
    this.store.saveAbsence({
      id: this.absence()?.id,
      type: this.type(),
      start: this.start(),
      end: this.end(),
      halfDay: this.start() === this.end() && this.halfDay(),
      note: this.note().trim() || undefined,
      googleEventId: this.absence()?.googleEventId,
      googleSyncedAt: this.absence()?.googleSyncedAt,
    });
    this.closed.emit();
    this.ui.show(`${ABSENCE_LABELS[this.type()]} gespeichert`);
  }

  async remove() {
    const a = this.absence();
    if (!a) return;
    if (!(await this.ui.confirm('Abwesenheit löschen?', `${ABSENCE_LABELS[a.type]} wird entfernt.`, 'Löschen', true))) return;
    this.store.deleteAbsence(a.id);
    this.closed.emit();
  }
}
