import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { addDays, dateKey, fmtTime, timeToTs, todayKey } from '../core/date-utils';
import { EntryKind, Place, TimeEntry } from '../core/models';
import { Store } from '../core/store';
import { Ui } from '../core/ui';
import { Icon } from './icon';
import { Sheet } from './sheet';

/** Bearbeiten/Anlegen eines Zeiteintrags (Arbeit, Pause oder Uni) */
@Component({
  selector: 'app-entry-editor',
  imports: [Sheet, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sheet [title]="entry() ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen'" (closed)="closed.emit()">
      @if (mode() === 'work') {
        <div class="segmented">
          <button type="button" [class.on]="kind() === 'work'" (click)="kind.set('work')">
            <app-icon name="timer" [size]="18" /> Arbeit
          </button>
          <button type="button" [class.on]="kind() === 'pause'" (click)="kind.set('pause')">
            <app-icon name="lunch" [size]="18" /> Pause
          </button>
        </div>
      }
      <div class="form-grid">
        <div class="field full">
          <label for="ee-date">Datum</label>
          <input id="ee-date" type="date" [(ngModel)]="date" required />
        </div>
        <div class="field">
          <label for="ee-from">Von</label>
          <input id="ee-from" type="time" [(ngModel)]="from" required />
        </div>
        <div class="field">
          <label for="ee-to">Bis</label>
          <input id="ee-to" type="time" [(ngModel)]="to" />
          <span class="hint">leer = läuft noch</span>
        </div>
      </div>
      @if (kind() === 'work') {
        <div class="segmented">
          <button type="button" [class.on]="place() === 'buero'" (click)="place.set('buero')">
            <app-icon name="office" [size]="18" /> Büro
          </button>
          <button type="button" [class.on]="place() === 'homeoffice'" (click)="place.set('homeoffice')">
            <app-icon name="home" [size]="18" /> Homeoffice
          </button>
        </div>
      }
      <div class="field">
        <label for="ee-note">{{ mode() === 'uni' ? 'Fach / Thema' : 'Notiz' }}</label>
        <input id="ee-note" type="text" [(ngModel)]="note" [attr.list]="mode() === 'uni' ? 'uni-subjects' : null" />
        @if (mode() === 'uni') {
          <datalist id="uni-subjects">
            @for (s of subjects(); track s) {
              <option [value]="s"></option>
            }
          </datalist>
        }
      </div>
      <ng-container actions>
        @if (entry()) {
          <button class="btn text" type="button" (click)="remove()"><app-icon name="delete" [size]="18" /> Löschen</button>
        }
        <span class="spacer"></span>
        <button class="btn text" type="button" (click)="closed.emit()">Abbrechen</button>
        <button class="btn" type="button" (click)="save()">Speichern</button>
      </ng-container>
    </app-sheet>
  `,
})
export class EntryEditor implements OnInit {
  private store = inject(Store);
  private ui = inject(Ui);

  readonly entry = input<TimeEntry | null>(null);
  readonly day = input<string>(todayKey());
  readonly mode = input<'work' | 'uni'>('work');
  readonly defaultKind = input<EntryKind>('work');
  readonly closed = output();

  protected kind = signal<EntryKind>('work');
  protected date = signal('');
  protected from = signal('');
  protected to = signal('');
  protected place = signal<Place>('homeoffice');
  protected note = signal('');
  protected subjects = signal<string[]>([]);

  ngOnInit() {
    const e = this.entry();
    const s = this.store.data().settings;
    if (e) {
      this.kind.set(e.kind);
      this.date.set(dateKey(e.start));
      this.from.set(fmtTime(e.start));
      this.to.set(e.end ? fmtTime(e.end) : '');
      this.place.set(e.place ?? s.defaultPlace);
      this.note.set(e.note ?? '');
    } else {
      this.kind.set(this.mode() === 'uni' ? 'uni' : this.defaultKind());
      this.date.set(this.day());
      const isLunch = this.defaultKind() === 'pause';
      this.from.set(isLunch ? s.lunchStart : '08:00');
      this.to.set(isLunch ? s.lunchEnd : '16:30');
      this.place.set(s.defaultPlace);
    }
    if (this.mode() === 'uni') {
      const set = new Set(this.store.data().entries.filter((x) => x.kind === 'uni' && x.note).map((x) => x.note!));
      this.subjects.set([...set].sort());
    }
  }

  save() {
    if (!this.date() || !this.from()) {
      this.ui.show('Bitte Datum und Startzeit angeben');
      return;
    }
    const start = timeToTs(this.date(), this.from());
    let end: number | null = this.to() ? timeToTs(this.date(), this.to()) : null;
    if (end !== null && end <= start) end = timeToTs(addDays(this.date(), 1), this.to()); // über Mitternacht
    const kind = this.kind();
    if (end === null) {
      const other = this.store.data().entries.find((x) => x.kind === kind && x.end === null && x.id !== this.entry()?.id);
      if (other) {
        this.ui.show('Es läuft bereits ein Eintrag dieser Art – bitte Endzeit angeben');
        return;
      }
    }
    const changes: Partial<TimeEntry> = {
      kind,
      start,
      end,
      place: kind === 'work' ? this.place() : undefined,
      note: this.note().trim() || undefined,
    };
    const e = this.entry();
    if (e) {
      if (kind === 'work' && e.place !== this.place()) changes.placeAuto = false;
      this.store.updateEntry(e.id, changes);
    } else {
      this.store.addEntry(changes as Omit<TimeEntry, 'id'>);
    }
    this.closed.emit();
  }

  async remove() {
    const e = this.entry();
    if (!e) return;
    this.store.deleteEntry(e.id);
    this.closed.emit();
    this.ui.show('Eintrag gelöscht', { label: 'Rückgängig', run: () => this.store.addEntry(e) });
  }
}
